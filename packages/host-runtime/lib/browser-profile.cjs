'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
const {readJson,writeJson,inside,distinct,failure}=require('./files.cjs');
const PROFILE_MODULES=['Local Storage','IndexedDB','Session Storage','Preferences','Local State','Network','Cookies','Cookies-journal','WebStorage','databases','File System','blob_storage','shared_proto_db'];
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/** 在独占环境锁内、Chromium 初始化之前同步复制持久资料，不复制缓存和程序文件。 */
function prepareBrowserProfile({source,target,journalFile,activate,maxBytes=512*1024*1024}) {
    distinct(source,target);
    let state=readJson(journalFile,null);
    if(state&&(state.source!==source||state.target!==target))throw failure('PROFILE_MIGRATION_MISMATCH','浏览器资料任务与当前环境不匹配，原资料继续保留');
    if(!state)state={schemaVersion:1,id:randomUUID(),source,target,phase:'copying',files:[]};
    const marker=path.join(target,'.profile-owner.json');
    if(fs.existsSync(target)) {
        const owner=readJson(marker,null);
        if(!owner&&fs.readdirSync(target).length)throw failure('PROFILE_TARGET_NOT_EMPTY','目标浏览器资料已有内容，请核对目录，原资料未删除');
        if(owner&&owner.id!==state.id)throw failure('PROFILE_TARGET_CHANGED','目标浏览器资料不属于当前任务');
    }
    const files=[];let total=0;
    const visit=(file,relative)=>{
        let stat;try{stat=fs.lstatSync(file);}catch(error){if(error.code==='ENOENT')return;throw error;}
        if(stat.isSymbolicLink())throw failure('PROFILE_LINK_UNSUPPORTED','浏览器资料中包含链接，保留原位置等待核对');
        if(stat.isDirectory()){for(const name of fs.readdirSync(file).sort())visit(path.join(file,name),path.join(relative,name));return;}
        if(!stat.isFile()||files.length>=100000)throw failure('PROFILE_FILE_LIMIT','浏览器资料超出快照范围，原资料仍有效');
        total+=stat.size;if(total>maxBytes)throw failure('PROFILE_SIZE_LIMIT','持久资料较大，请先关闭应用后重试迁移；原资料仍保留');
        files.push({source:file,destination:inside(target,path.join(target,relative)),digest:hash(file)});
    };
    for(const name of PROFILE_MODULES)visit(inside(source,path.join(source,name)),name);
    const partitions=path.join(source,'Partitions');
    if(fs.existsSync(partitions)) {
        const entries=fs.readdirSync(partitions,{withFileTypes:true});
        if(entries.length>64)throw failure('PROFILE_PARTITION_LIMIT','应用浏览器资料分区过多，原资料已保留');
        for(const entry of entries) {
            if(entry.isSymbolicLink())throw failure('PROFILE_LINK_UNSUPPORTED','应用浏览器资料包含链接，原资料已保留');
            if(!entry.isDirectory()||!/^[a-z][a-z0-9-]{0,63}$/.test(entry.name))continue;
            for(const name of PROFILE_MODULES) {const relative=path.join('Partitions',entry.name,name);visit(inside(source,path.join(source,relative)),relative);}
        }
    }
    fs.mkdirSync(target,{recursive:true});writeJson(marker,{id:state.id});
    const previous=new Map(state.files.map(entry=>[entry.destination,entry.digest]));
    state={...state,phase:'copying',files};writeJson(journalFile,state);
    for(const item of files) {
        if(fs.existsSync(item.destination)) {
            const existing=hash(item.destination);
            if(existing===item.digest)continue;
            if(existing!==previous.get(item.destination))throw failure('PROFILE_TARGET_CHANGED','目标资料被修改，双方内容均已保留');
        }
        fs.mkdirSync(path.dirname(item.destination),{recursive:true});
        const temporary=item.destination+'.'+randomUUID()+'.tmp';
        try{fs.copyFileSync(item.source,temporary);if(hash(temporary)!==item.digest)throw failure('PROFILE_SOURCE_CHANGED','原资料仍被写入，请关闭原实例后重试');fs.renameSync(temporary,item.destination);}
        finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
    }
    for(const item of files)if(hash(item.source)!==item.digest||hash(item.destination)!==item.digest)throw failure('PROFILE_VERIFY_FAILED','浏览器资料核对未通过，原位置保持有效');
    activate(target);
    state={...state,phase:'awaiting-startup'};writeJson(journalFile,state);
    return {profile:target,journalFile};
}

/** 新资料实际打开后才清理快照中的旧文件；变化或权限不足均保留并登记。 */
function completeBrowserProfile(journalFile,{source,activeProfile}) {
    const state=readJson(journalFile,null);
    if(!state||!['copying','awaiting-startup','cleanup-pending'].includes(state.phase))return null;
    if(state.source!==source||state.target!==activeProfile)throw failure('PROFILE_ACTIVATION_UNCONFIRMED','新浏览器资料尚未确认启用，旧副本保持原位');
    const failures=[];
    for(const item of state.files) {
        try{
            inside(state.source,item.source);inside(state.target,item.destination);
            if(!fs.existsSync(item.source))continue;
            if(!fs.existsSync(item.destination)||hash(item.source)!==item.digest)throw failure('PROFILE_SOURCE_CHANGED','旧资料已变化，保留副本等待核对');
            fs.unlinkSync(item.source);
        }catch(error){failures.push({path:item.source,message:error.message});}
    }
    const next={...state,phase:failures.length?'cleanup-pending':'completed',failures};writeJson(journalFile,next);
    return {phase:next.phase,source:state.source,target:state.target,failures};
}
module.exports={prepareBrowserProfile,completeBrowserProfile};
