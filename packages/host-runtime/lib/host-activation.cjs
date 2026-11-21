'use strict';
const path=require('node:path');
const {spawn}=require('node:child_process');
const {createHostLauncher}=require('./application-modules.cjs');
const {kernelAddress}=require('./environment.cjs');
const {connect}=require('./kernel.cjs');
const {readJson,failure}=require('./files.cjs');

/** 转交给已安装的公共基建；目标没有就绪前启动器保留反馈，不打开第二份资料库。 */
async function activateHost({environment,applicationId,timeoutMs=60000,spawnProcess=spawn}) {
    const launcher=createHostLauncher(environment).read();if(!launcher)return false;
    if(typeof launcher.sourceId!=='string')throw failure('HOST_PROTOCOL_MISSING','公共基建入口需要更新，请先启动新版基建');
    const address=kernelAddress(environment),deadline=Date.now()+timeoutMs;
    const activate=async()=>{
        const auth=readJson(path.join(environment.root,'runtime','kernel-auth.json'),null);
        if(!auth)throw Object.assign(Error('正在启动基建'),{code:'ENOENT'});
        const response=await connect(address,{version:1,environmentId:environment.id,token:auth.token,sourceId:launcher.sourceId,applicationId,action:'activate'},Math.max(2000,deadline-Date.now()));
        if(!response.success)throw failure(response.code,response.error);
    };
    try {await activate();return true;}catch(error){if(!['ENOENT','ECONNREFUSED','EPIPE'].includes(error.code))throw error;}
    const args=[...launcher.args,'--application='+applicationId];
    if(environment.mode==='test')args.push('--test-root='+environment.root);
    const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
    const child=spawnProcess(launcher.executable,args,{cwd:launcher.directory,env,detached:true,windowsHide:true,stdio:'ignore'});
    let launchError;child.once('error',error=>{launchError=error;});
    while(Date.now()<deadline) {
        if(launchError)throw launchError;
        try {await activate();child.unref();return true;}catch(error){if(!['ENOENT','ECONNREFUSED','EPIPE'].includes(error.code))throw error;}
        if(child.exitCode!==null&&child.exitCode!==0)throw failure('HOST_START_FAILED','公共基建尚未启动成功，请检查其启动日志，已有资料已保留');
        await new Promise(resolve=>setTimeout(resolve,200));
    }
    throw failure('HOST_START_TIMEOUT','公共基建仍未就绪，已有资料与后台任务均已保留');
}
module.exports={activateHost};
