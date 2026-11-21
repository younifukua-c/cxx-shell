'use strict';
const path=require('node:path');
const {failure}=require('./files.cjs');
const {legacyWriters}=require('./migration-guard.cjs');

/** Chromium 打开资料前按环境加锁；锁位置跟随保留的会话资料，迁移后仍保持同一身份。 */
function claimInstance({app,runtime,applicationName,applicationId,onActivate,listProcesses}) {
    const profile=runtime.layout.profile;
    let primary;
    try {
        app.setPath('userData',runtime.environment.instanceLock||path.join(profile,'cxx-instance-lock'));
        primary=app.requestSingleInstanceLock({environmentId:runtime.environment.id,sourceId:runtime.sourceId,applicationId});
    } finally {app.setPath('userData',profile);}
    if(!primary)return false;
    if(runtime.environment.mode==='production'&&(runtime.environment.layout==='legacy'||runtime.environment.browserProfile)) {
        const others=legacyWriters(listProcesses(),applicationName);
        if(others.length) {
            app.releaseSingleInstanceLock();
            throw failure('LEGACY_INSTANCE_RUNNING','原正式软件仍在运行。请继续使用原窗口，或保存并退出原软件后再启动新版。原数据与浏览器资料尚未打开。');
        }
    }
    app.on('second-instance',(_event,_argv,_directory,data)=>{
        if(data?.environmentId!==runtime.environment.id||data?.sourceId!==runtime.sourceId) {
            onActivate(failure('KERNEL_SOURCE_MISMATCH','该环境已运行另一份程序，请先退出当前环境，或为另一工作盘指定独立测试目录'));
        } else onActivate(null,data.applicationId);
    });
    return true;
}
module.exports={claimInstance};
