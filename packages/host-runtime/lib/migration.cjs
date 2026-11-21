'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { readJson, writeJson,writeContents, canonical, failure, inside, digest, presence } = require('./files.cjs');
const { inventory, copyVerified, cleanupFiles } = require('./migration-files.cjs');
const MIN_METADATA_FREE_BYTES=64*1024;

/** 创建可恢复迁移任务；调用方提供写入屏障与唯一激活入口。 */
function createMigration({ journalFile, mappings, activate, barrier, onChange=()=>{}, activeRoot=()=>'',capacity=availableBytes,canCleanup=()=>true,fileSystem=fs }) {
    const io=fileSystem;
    let state=readJson(journalFile,null), running=false;
    const replicaDigests=new Map((state?.files||[]).map(item=>[item.destination,item.digest]));
    if(state&&['copying','verifying','switching'].includes(state.phase)) state={...state,phase:state.phase==='switching'?'recovery-required':'interrupted'};
    const snapshot=()=>state?structuredClone({...state,files:undefined,fileCount:state.files?.length||0,cleanupFailures:state.cleanupFailures?.slice(0,200),cleanupFailureCount:state.cleanupFailures?.length||0}):null;
    const save=patch=>{ state={...state,...patch}; writeJson(journalFile,state); onChange(snapshot()); };
    const ensureAvailable=()=>{if(running) throw failure('MIGRATION_BUSY','迁移任务正在执行，请等待当前阶段完成');};
    const assertTarget=target=>{
        const marker=readJson(path.join(target,'.migration-owner.json'),null);
        if(!marker||marker.id!==state.id) throw failure('MIGRATION_TARGET_CHANGED','目标迁移身份不一致，已保留原目录');
    };
    const validateFiles=()=>{
        for(const item of state.files||[]) {
            inside(state.target,item.destination);
            const mapping=mappings.find(candidate=>{
                const relative=path.relative(candidate.source,item.source);
                return !relative||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));
            });
            if(!mapping||path.resolve(state.target,mapping.destination,path.relative(mapping.source,item.source))!==path.resolve(item.destination)) throw failure('MIGRATION_JOURNAL_INVALID','迁移记录包含越界文件，未执行清理');
        }
    };
    const reconcile=async()=>{
        assertTarget(state.target);
        const items=await inventory(mappings,state.target,io);
        const current=new Set(items.map(item=>item.destination));
        for(const previous of state.files||[]) {
            inside(state.target,previous.destination);
            if(!current.has(previous.destination)&&io.existsSync(previous.destination)) {
                if(await digest(previous.destination,io)!==previous.digest) throw failure('MIGRATION_TARGET_CHANGED','目标文件已被其他程序修改');
                await io.promises.unlink(previous.destination);
            }
        }
        const total=items.reduce((sum,item)=>sum+item.size,0); let copied=0;
        const previousFiles=new Map((state.files||[]).map(item=>[item.destination,item.digest]));
        save({phase:'copying',totalBytes:total,copiedBytes:0,files:items,error:null});
        let count=0,lastProgress=0;
        for(const item of items) {
            const existing=io.existsSync(item.destination)?await digest(item.destination,io):null;
            if(existing && existing!==item.digest && existing!==previousFiles.get(item.destination)) throw failure('MIGRATION_TARGET_CHANGED','目标文件已变化，停止复制并保留双方内容');
            if(existing!==item.digest) await copyVerified(item,io);
            replicaDigests.set(item.destination,item.digest);
            copied+=item.size;
            count++;
            state={...state,copiedBytes:copied,description:`已复制 ${count} / ${items.length} 个文件`};
            if(Date.now()-lastProgress>=100||count===items.length) {lastProgress=Date.now();onChange(snapshot());}
        }
        save({phase:'verifying',description:'正在核对源与目标内容'});
        const after=await inventory(mappings,state.target,io);
        if(JSON.stringify(after)!==JSON.stringify(items)) throw failure('MIGRATION_SOURCE_CHANGED','源数据仍在更新，将继续同步');
        for(const item of items) if(await digest(item.destination,io)!==item.digest) throw failure('MIGRATION_VERIFY_FAILED','目标内容校验失败，原数据保持有效');
        save({files:items});
    };
    return {
        snapshot,
        recover() {
            ensureAvailable();
            if(state?.phase!=='recovery-required') throw failure('RECOVERY_NOT_REQUIRED','当前没有需要确认的切换');
            const activated=activeRoot()&&canonical(activeRoot())===canonical(state.target);
            save({phase:activated?'cleanup-pending':'interrupted',description:activated?'已确认新目录有效，旧副本仍保留':'原目录仍有效，可以重新同步',error:null});
            return snapshot();
        },
        committed(source, contents) {
            if(!state||!['copying','verifying','ready'].includes(state.phase)) return;
            try {
                const mapping=mappings.find(item=>{
                    const relative=path.relative(item.source,source);
                    return !relative||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));
                });
                if(!mapping) return;
                assertTarget(state.target);
                const relative=path.relative(mapping.source,source);
                const destination=inside(state.target,path.join(state.target,mapping.destination,relative));
                if(io.existsSync(destination)) {
                    if(io.statSync(destination).size>32*1024*1024) throw failure('REPLICA_FILE_LIMIT','目标副本超过接续写入上限，请重新同步');
                    const existing=createHash('sha256').update(io.readFileSync(destination)).digest('hex');
                    if(existing!==replicaDigests.get(destination)) throw failure('MIGRATION_TARGET_CHANGED','目标副本已被修改，已保留双方内容，请核对后继续');
                }
                writeContents(destination,contents,io);replicaDigests.set(destination,createHash('sha256').update(contents).digest('hex'));
            } catch(error) { save({phase:'interrupted',error:{code:error.code||'REPLICA_WRITE_FAILED',message:error.message},description:'副本接续暂停，主目录仍正常保存，可重新同步'}); }
        },
        async prepare(targetDirectory) {
            ensureAvailable();
            running=true;
            try {
            if(state&&!['completed','cancelled'].includes(state.phase)) throw failure('MIGRATION_PENDING','请先恢复或清理已有迁移，旧副本记录会继续保留');
            const target=canonical(targetDirectory);
            const planned=await inventory(mappings,target,io);
            if(io.existsSync(target)&&io.readdirSync(target).length) throw failure('MIGRATION_TARGET_NOT_EMPTY','请选择空的目标目录，避免覆盖已有文件');
            const requiredBytes=planned.reduce((sum,item)=>sum+item.size,0)+MIN_METADATA_FREE_BYTES;
            const freeBytes=await capacity(target);
            if(freeBytes!==null&&freeBytes<requiredBytes)throw failure('MIGRATION_SPACE_INSUFFICIENT','目标磁盘空间不足，请选择其他目录或清理空间后重试；当前继续使用原目录');
            const id=randomUUID(); io.mkdirSync(target,{recursive:true});
            replicaDigests.clear();
            writeJson(path.join(target,'.migration-owner.json'),{id});
            state={schemaVersion:1,id,target,phase:'planned',requiredBytes,availableBytes:freeBytes,sourceRoots:mappings.map(item=>canonical(item.source)),files:[]};
            save({description:'迁移计划已创建，尚未切换'});
            return await synchronize();
            } finally { running=false; }
        },
        async resume() {
            ensureAvailable(); if(!state||!['planned','interrupted','failed','ready'].includes(state.phase)) throw failure('MIGRATION_NOT_RESUMABLE','当前阶段不能继续复制');
            running=true;
            try {return await synchronize();}
            finally { running=false; }
        },
        async switch() {
            ensureAvailable(); if(state?.phase!=='ready') throw failure('MIGRATION_NOT_READY','验证通过后才能切换');
            running=true; let activated=false;
            try {
                await barrier(async()=>{
                    await reconcile();
                    save({phase:'switching',description:'最新写入已同步，正在切换位置'});
                    await activate(state.target,state.id); activated=true;
                    save({phase:'cleanup-pending',description:'已切换，正在清理已校验的旧副本'});
                });
            } catch(error) {
                activated=activated||error.activationCommitted===true;
                save({phase:activated?'recovery-required':'interrupted',error:{code:error.code||'SWITCH_FAILED',message:error.message},description:activated?'正在确认切换结果，旧副本仍保留':'切换未完成，继续使用原目录'});
                return snapshot();
            } finally { running=false; }
            return this.cleanup();
        },
        async cleanup() {
            ensureAvailable(); if(state?.phase!=='cleanup-pending') throw failure('CLEANUP_NOT_READY','只有成功切换的副本可以清理');
            running=true;
            try {
                validateFiles();
                const failures=await cleanupFiles(state.files,mappings.map(item=>canonical(item.source)),canCleanup,io);
                save({phase:failures.length?'cleanup-pending':'completed',cleanupFailures:failures,description:failures.length?'已切换，部分旧文件尚未清理':'迁移完成，已清理旧副本文件'});
                return snapshot();
            } finally { running=false; }
        },
        inspectOldCopies() { return state ? state.sourceRoots.map(directory=>({directory,status:presence(directory)})) : []; },
        cancel() {
            ensureAvailable(); if(!state||['switching','cleanup-pending','completed','recovery-required'].includes(state.phase)) throw failure('MIGRATION_CANNOT_CANCEL','当前阶段不能取消，请确认切换状态');
            save({phase:'cancelled',description:'已取消，原数据继续使用；目标副本已保留'}); return snapshot();
        },
    };
    async function synchronize() {
        try {
            for(let attempt=0;attempt<3;attempt++) {
                try {await reconcile();save({phase:'ready',description:'副本校验通过，切换前会同步最新写入'});return snapshot();}
                catch(error){if(error.code!=='MIGRATION_SOURCE_CHANGED'||attempt===2)throw error;}
            }
        } catch(error){save({phase:error.code==='MIGRATION_SOURCE_CHANGED'?'interrupted':'failed',error:{code:error.code||'MIGRATION_FAILED',message:error.message},description:'当前继续使用原目录'});return snapshot();}
    }
}
module.exports = { createMigration };

/** 查询目标所在卷的空间；不支持查询的卷由实际复制与核验继续保护。 */
async function availableBytes(directory) {
    let ancestor=directory;
    while(!fs.existsSync(ancestor)){const parent=path.dirname(ancestor);if(parent===ancestor)throw failure('PATH_UNAVAILABLE','目标磁盘无法访问');ancestor=parent;}
    try {const stat=await fs.promises.statfs(ancestor,{bigint:true});return Number(stat.bavail*stat.bsize);}
    catch(error){if(['ENOSYS','ENOTSUP'].includes(error.code))return null;throw error;}
}
