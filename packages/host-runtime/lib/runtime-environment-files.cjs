'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {inside,readJson,failure}=require('./files.cjs');

/** 运行环境按技术、兼容系列和目标平台共享；不以产品版本或应用命名。 */
function environmentKey(requirement) {
    const fields=['technology','compatibility','platform','arch'];
    if(!requirement||fields.some(key=>typeof requirement[key]!=='string'||!/^[a-z0-9][a-z0-9-]{0,15}$/.test(requirement[key])))throw failure('ENVIRONMENT_REQUIREMENT_INVALID','运行环境要求无效');
    if(!/^[a-z][a-z0-9]{0,15}$/.test(requirement.technology))throw failure('ENVIRONMENT_REQUIREMENT_INVALID','技术名称必须使用规范标识');
    const key=fields.map(field=>requirement[field]).join('-');
    if(key.length>64)throw failure('ENVIRONMENT_REQUIREMENT_INVALID','运行环境标识过长');
    if(requirement.platform!==process.platform||requirement.arch!==process.arch)throw failure('ENVIRONMENT_PLATFORM_MISMATCH','此运行环境不适用于当前电脑，请选择对应系统的安装包');
    return key;
}
/** 仅清理已确认退出的进程租约；无权限探测的进程始终视为在用。 */
function alive(pid) {
    if(!Number.isSafeInteger(pid)||pid<=0)return true;
    try{process.kill(pid,0);return true;}catch(error){return error.code!=='ESRCH';}
}
/** 跨内核串行更新公共环境，等待有界，不按进程名结束任何程序。 */
async function environmentLock(directory,operation) {
    fs.mkdirSync(directory,{recursive:true});
    const file=path.join(directory,'.environment-lock.json'),token=randomUUID(),deadline=Date.now()+120000;
    while(true) {
        try{const fd=fs.openSync(file,'wx',0o600);try{fs.writeFileSync(fd,JSON.stringify({token,pid:process.pid}));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}break;}
        catch(error){
            if(error.code!=='EEXIST')throw error;
            let owner;try{owner=readJson(file,null);}catch(error){if(error.code!=='DOCUMENT_UNREADABLE')throw error;}
            if(owner&&!alive(owner.pid)){try{if(readJson(file,null)?.token===owner.token)fs.unlinkSync(file);}catch(error){if(error.code!=='ENOENT')throw error;}continue;}
            if(Date.now()>=deadline)throw failure('ENVIRONMENT_BUSY','公共运行环境正在由另一个窗口准备，请稍后重试');
            await new Promise(resolve=>setTimeout(resolve,50));
        }
    }
    try{return await operation();}finally{if(readJson(file,null)?.token===token)fs.unlinkSync(file);}
}
/** 集合一次读取；每个进程只探测一次，损坏集合不可解释为无人使用。 */
function environmentLeases(directory) {
    const records=readJson(inside(directory,path.join(directory,'leases.json')),[]),processes=new Map();
    if(!Array.isArray(records)||records.length>4096)throw failure('ENVIRONMENT_RECORD_LIMIT','运行环境占用记录无效或过多，请先修复安装登记');
    return records.filter(value=>{
        if(!value||typeof value.token!=='string'||typeof value.applicationId!=='string'||typeof value.slot!=='string'||typeof value.directory!=='string')throw failure('ENVIRONMENT_LEASE_INVALID','运行环境占用记录无法确认，现有环境已保留');
        if(!processes.has(value.pid))processes.set(value.pid,alive(value.pid));return processes.get(value.pid);
    });
}
function applicationKey(id) {
    if(!/^[a-z][a-z0-9-]{0,63}$/.test(id||''))throw failure('APPLICATION_ID_INVALID','应用标识无效');
    return id;
}
module.exports={environmentKey,environmentLock,environmentLeases,applicationKey};
