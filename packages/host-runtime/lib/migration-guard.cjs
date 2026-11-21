'use strict';
const {failure}=require('./files.cjs');

/** 切换前核对写入者；不终止其他实例或正在执行的任务。 */
function createMigrationGuard({environment,applicationName,pid=process.pid,listOwned,listProcesses}) {
    return async()=>{
        if(listOwned().some(item=>item.kind==='script')) throw failure('MIGRATION_TASKS_ACTIVE','脚本仍在执行，原目录继续使用；脚本结束后可继续迁移');
        if(environment.mode!=='production'||environment.layout!=='legacy') return;
        const processes=await listProcesses();
        const others=legacyWriters(processes,applicationName,pid);
        if(others.length) throw failure('LEGACY_WRITER_ACTIVE','检测到尚未接入统一内核的旧实例，原目录继续使用。请先保存并退出旧实例，再继续迁移；其他测试环境不会被关闭');
    };
}

/** 正式环境只关注旧正式实例，明确标注目录的测试实例独立运行。 */
function legacyWriters(processes,applicationName,pid=process.pid) {
    return processes.filter(item=>item.pid!==pid && !/--type=|--test-root(?:=|\s)|--test-user-data(?:=|\s)/.test(item.commandLine||'') &&
            ((item.executable||'').toLowerCase().endsWith(applicationName.toLowerCase()+'.exe') ||
            (item.commandLine||'').toLowerCase().includes(applicationName.toLowerCase())));
}
module.exports={createMigrationGuard,legacyWriters};
