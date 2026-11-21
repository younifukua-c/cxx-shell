'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {readJson,writeJson,inside,canonical,digest,failure,presence}=require('./files.cjs');
const {inventory,copyVerified}=require('./migration-files.cjs');

/** 创建受控安装目录；双槽只保存当前包和一个待切换包。 */
function createInstallations({root,owner,scope='application',leases=()=>[],verify=async()=>false,activate=async()=>{},onProgress=()=>{},fileSystem=fs,exclude=[]}) {
    if(!['application','environment'].includes(scope))throw failure('INSTALL_SCOPE_INVALID','安装类别无效');
    const directory=canonical(root),stateFile=path.join(directory,scope==='environment'?'environments.json':'installations.json');
    let state=readJson(stateFile,{schemaVersion:1,id:randomUUID(),owner,applications:{}});
    if(state.schemaVersion!==1||typeof state.id!=='string'||!state.applications||typeof state.applications!=='object'||Array.isArray(state.applications))throw failure('INSTALL_REGISTRY_INVALID','安装登记无法确认，原程序目录已保留');
    if(owner!==undefined&&state.owner!==owner)throw failure('INSTALL_OWNER_MISMATCH','安装目录属于其他账户或尚未确认归属，请选择本账户的空安装目录');
    const appRoot=id=>{if(!/^[a-z][a-z0-9-]{0,63}$/.test(id)) throw failure('APPLICATION_ID_INVALID','应用标识无效');return inside(directory,path.join(directory,scope==='environment'?'infrastructure/environments':id==='runtime'?'infrastructure':'apps',id));};
    const slotPath=(id,slot)=>{
        if(!['slot-a','slot-b'].includes(slot)) throw failure('INSTALL_SLOT_INVALID','安装位置无效');
        return inside(appRoot(id),path.join(appRoot(id),slot));
    };
    const save=(next=state)=>{writeJson(stateFile,next);state=next;};
    const update=(id,record)=>save({...state,applications:{...state.applications,[id]:record}});
    const inUse=(id,slot)=>leases().some(lease=>lease.applicationId===id&&lease.slot===slot&&(!lease.directory||lease.directory===slotPath(id,slot)||lease.directory.startsWith(slotPath(id,slot)+path.sep)));
    const busy=new Set();
    const removeSlot=(id,slot)=>{
        const target=slotPath(id,slot),marker=readJson(path.join(target,'.install-owner.json'),null);
        if(!fs.existsSync(target)) return;
        if(marker?.installationId!==state.id||marker?.applicationId!==id) throw failure('INSTALL_OWNERSHIP_INVALID','目录不属于当前安装记录，已保留');
        if(inUse(id,slot)) throw failure('INSTALL_IN_USE','旧版本仍在使用，将在退出后清理');
        fileSystem.rmSync(target,{recursive:true});
    };
    return {
        list:()=>structuredClone(state.applications),
        async prepare(manifest,source) {
            const id=manifest?.id;appRoot(id);
            if(busy.has(id))throw failure('INSTALLATION_BUSY','此应用正在准备或切换，请等待当前操作完成');busy.add(id);
            try {
            if(!manifest||!Array.isArray(manifest.files)||!manifest.files.length||manifest.files.length>100000) throw failure('PACKAGE_MANIFEST_INVALID','安装包文件清单无效');
            if(!/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(manifest.version||'')) throw failure('PACKAGE_VERSION_INVALID','安装包版本无效');
            appRoot(id);
            if(!await verify(manifest)) throw failure('PACKAGE_SIGNATURE_INVALID','安装包来源未通过验证');
            save();
            const current=state.applications[id]||{active:null,pending:null};
            const slot=current.active==='slot-a'?'slot-b':'slot-a';
            if(inUse(id,slot)) throw failure('INSTALL_SLOTS_BUSY','两个程序位置仍在使用，当前版本继续运行，退出旧版本后可继续准备');
            const target=slotPath(id,slot);removeSlot(id,slot);
            fs.mkdirSync(target,{recursive:true});
            writeJson(path.join(target,'.install-owner.json'),{installationId:state.id,applicationId:id});
            onProgress({phase:'verifying',description:'正在核对程序来源与文件清单'});
            const sourceRoot=canonical(source),copies=await inventory([{source:sourceRoot,destination:'payload'}],target,fileSystem,exclude);
            const declared=new Map(manifest.files.map(file=>[file.path,file.sha256]));
            if(declared.size!==manifest.files.length||copies.length!==declared.size) throw failure('PACKAGE_CONTENT_INVALID','实际文件与安装清单不一致');
            if(manifest.entry&&!declared.has(manifest.entry))throw failure('PACKAGE_ENTRY_INVALID','程序入口不在已校验文件清单中');
            const totalBytes=copies.reduce((sum,item)=>sum+item.size,0);let copiedBytes=0,last=0;
            for(const item of copies) {
                const relative=path.relative(sourceRoot,item.source).split(path.sep).join('/');
                if(declared.get(relative)!==item.digest) throw failure('PACKAGE_DIGEST_INVALID','安装包内容校验失败');
                await copyVerified(item,fileSystem);
                copiedBytes+=item.size;if(Date.now()-last>=100||copiedBytes===totalBytes){last=Date.now();onProgress({phase:'copying',copiedBytes,totalBytes,description:'正在复制并核对程序文件'});}
            }
            writeJson(path.join(target,'manifest.json'),manifest);
            update(id,{...current,pending:slot,pendingVersion:manifest.version});
            return {id,slot,version:manifest.version,phase:'ready'};
            }finally{busy.delete(id);}
        },
        async switch(id) {
            if(busy.has(id))throw failure('INSTALLATION_BUSY','此应用正在准备或切换，请等待当前操作完成');busy.add(id);
            try {
            const record=state.applications[id];if(!record?.pending) throw failure('INSTALL_NOT_READY','新版本尚未准备完成');
            const manifest=readJson(path.join(slotPath(id,record.pending),'manifest.json'),null);
            if(!manifest||!await verify(manifest)) throw failure('PACKAGE_SIGNATURE_INVALID','切换前来源验证失败');
            for(const entry of manifest.files) {
                const file=inside(slotPath(id,record.pending),path.join(slotPath(id,record.pending),'payload',entry.path));
                if(await digest(file,fileSystem)!==entry.sha256) throw failure('PACKAGE_DIGEST_INVALID','准备后的文件已改变，保留当前版本');
            }
            onProgress({phase:'probing',description:'文件核对通过，正在探测新程序'});
            await activate(id,slotPath(id,record.pending),manifest);
            update(id,{active:record.pending,version:manifest.version,entry:manifest.entry,pending:null,previous:record.active});
            return this.cleanup(id);
            }finally{busy.delete(id);}
        },
        cleanup(id) {
            const record=state.applications[id];if(!record?.previous) return {phase:'completed'};
            try {removeSlot(id,record.previous);update(id,{...record,previous:null});return {phase:'completed'};}
            catch(error) {return {phase:'cleanup-pending',path:slotPath(id,record.previous),status:presence(slotPath(id,record.previous)),reason:error.message};}
        },
        uninstall(id,{removeData=false,clearData=()=>{}}={}) {
            const record=state.applications[id];if(!record) throw failure('APPLICATION_NOT_INSTALLED','应用尚未安装');
            if(leases().some(lease=>lease.applicationId===id)) throw failure('APPLICATION_IN_USE','请先保存并关闭此应用，其他应用可继续使用');
            if(id==='runtime'&&Object.keys(state.applications).some(key=>key!=='runtime')) throw failure('RUNTIME_REQUIRED','仍有应用依赖公共基建');
            for(const slot of ['slot-a','slot-b']) removeSlot(id,slot);
            const applications={...state.applications};delete applications[id];save({...state,applications});
            if(removeData) clearData(id);
            return {phase:'uninstalled',dataRetained:!removeData};
        },
    };
}
module.exports={createInstallations};
