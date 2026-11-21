'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {canonical,inside,readJson,digest,failure}=require('./files.cjs');
const {createEnvironmentRecords}=require('./runtime-environment-records.cjs');
const {environmentKey,environmentLock,applicationKey}=require('./runtime-environment-files.cjs');
const LOCATION_RETRY_LIMIT=3;

/** 公共技术环境按需准备；构造和读取应用目录不会下载、复制或启动任何环境。 */
function createRuntimeEnvironments({root,activeRoot=()=>root,owner,provider={},onProgress=()=>{}}) {
    if(typeof owner!=='string'||!owner)throw failure('INSTALL_OWNER_MISMATCH','请先确认当前账户的安装归属');
    const records=()=>createEnvironmentRecords(activeRoot(),{owner,provider,onProgress});
    records();
    const leases=()=>records().leases();
    /** 排他等待期间可能完成位置切换，获得锁后重新确认唯一活动位置。 */
    async function withCurrentRecords(operation) {
        const retry=Symbol('location-changed');
        for(let attempt=0;attempt<LOCATION_RETRY_LIMIT;attempt++) {
            const current=records();
            const result=await environmentLock(current.maintenance,()=>current.directory===canonical(activeRoot())?operation(current):retry);
            if(result!==retry)return result;
        }
        throw failure('ENVIRONMENT_BUSY','安装位置正在切换，请稍后重试；现有运行环境已保留');
    }
    async function acquire(applicationId,requirement) {
        applicationKey(applicationId);const key=environmentKey(requirement);
        return withCurrentRecords(async current=>{
            const manager=current.installations();let record=manager.list()[key];
            if(!record?.active) {
                if(!provider.resolve)throw failure('ENVIRONMENT_NOT_INSTALLED','此应用所需的运行环境尚未准备，请修复或重新安装此应用；已有数据已保留');
                onProgress({phase:'preparing',description:'正在准备此应用需要的公共运行环境'});
                const artifact=await provider.resolve(requirement);
                if(artifact?.manifest?.id!==key)throw failure('ENVIRONMENT_PACKAGE_MISMATCH','运行环境包与应用的兼容要求不一致');
                await manager.prepare(artifact.manifest,artifact.source);await manager.switch(key);record=manager.list()[key];
            }
            const slot=current.slotPath(key,record.active),manifest=readJson(path.join(slot,'manifest.json'),null);
            if(!manifest||manifest.id!==key||!manifest.entry||!Array.isArray(manifest.files))throw failure('ENVIRONMENT_PACKAGE_INVALID','运行环境登记不完整，请修复安装；已有数据已保留');
            const payload=inside(slot,path.join(slot,'payload'));
            for(const entry of manifest.files)if(await digest(inside(payload,path.join(payload,entry.path)))!==entry.sha256)throw failure('PACKAGE_DIGEST_INVALID','公共运行环境文件已变化，请修复安装；已有数据已保留');
            const users=current.bindings(),previous=users.find(user=>user.applicationId===applicationId)||{environments:[]};
            if(!users.some(user=>user.applicationId===applicationId)&&users.length>=4096||!previous.environments.includes(key)&&previous.environments.length>=16)throw failure('ENVIRONMENT_RECORD_LIMIT','应用运行环境依赖超过容量限制');
            current.saveBindings([...users.filter(user=>user.applicationId!==applicationId),{applicationId,environments:[...new Set([...previous.environments,key])]}]);
            const token=randomUUID();
            const currentLeases=current.leases();if(currentLeases.length>=4096)throw failure('ENVIRONMENT_RECORD_LIMIT','运行环境使用记录超过容量限制');
            current.saveLeases([...currentLeases,{token,pid:process.pid,consumer:applicationId,applicationId:key,slot:record.active,directory:slot}]);
            let released=false;
            onProgress({phase:'completed',description:'公共运行环境已就绪'});
            return {key,version:manifest.version,directory:payload,executable:inside(payload,path.join(payload,manifest.entry)),
                async release(){
                    if(released)return;
                    await withCurrentRecords(current=>{
                        if(released)return;
                        const manager=current.installations(),registered=current.leases();
                        if(!manager.list()[key]||!registered.some(lease=>lease.token===token))
                            throw failure('ENVIRONMENT_LEASE_MISSING','当前安装位置缺少对应的运行环境使用登记，请恢复安装位置后重试；原程序已保留');
                        const active=registered.filter(lease=>lease.token!==token);
                        const users=current.bindings();
                        current.saveLeases(active);
                        if(!users.some(user=>user.environments.includes(key))&&!active.some(lease=>lease.applicationId===key)&&manager.list()[key])manager.uninstall(key);
                        released=true;
                    });
                }};
        });
    }
    return {acquire,leases,
        async list(){if(!fs.existsSync(records().maintenance))return [];return withCurrentRecords(current=>{const users=current.bindings();return Object.entries(current.installations().list()).filter(([,record])=>record.active).map(([key,record])=>({key,version:record.version,users:users.filter(user=>user.environments.includes(key)).map(user=>user.applicationId)}));});},
        async forget(applicationId){applicationKey(applicationId);if(!fs.existsSync(records().maintenance))return;return withCurrentRecords(current=>{
            const manager=current.installations();
            const users=current.bindings(),previous=users.find(user=>user.applicationId===applicationId),next=users.filter(user=>user.applicationId!==applicationId);
            current.saveBindings(next);const used=new Set(next.flatMap(user=>user.environments)),active=current.leases();
            for(const key of previous?.environments||[])if(!used.has(key)&&!active.some(lease=>lease.applicationId===key)&&manager.list()[key])manager.uninstall(key);
        });},
        async remove(requirement){const key=environmentKey(requirement);return withCurrentRecords(current=>{
            if(current.bindings().some(user=>user.environments.includes(key)))throw failure('ENVIRONMENT_REQUIRED','仍有已安装应用依赖此运行环境，请先卸载对应应用');
            const manager=current.installations();if(current.leases().some(lease=>lease.applicationId===key))throw failure('INSTALL_IN_USE','运行环境仍在使用，关闭对应应用后再清理');
            if(!manager.list()[key])return {phase:'absent'};
            return manager.uninstall(key);
        });},
    };
}
module.exports={createRuntimeEnvironments,environmentKey};
