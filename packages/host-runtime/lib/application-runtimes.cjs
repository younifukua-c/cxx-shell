'use strict';
const path=require('node:path');
const {readJson,inside,failure}=require('./files.cjs');
const {createRuntimeEnvironments,environmentKey}=require('./runtime-environments.cjs');

/** 明确加入的本地应用可携带离线环境分发清单；摘要校验不冒充远程发布者认证。 */
function createApplicationRuntimeScope({root,owner,application,installationRoot,activeInstallationRoot,onProgress}) {
    let closing=false,disposed=false,disposing=null;const active=new Set(),pending=new Set();
    const catalog=application.runtimePackages?readJson(inside(root,path.resolve(root,application.runtimePackages)),null):null;
    if(catalog&&(catalog.schemaVersion!==1||!Array.isArray(catalog.packages)||catalog.packages.length>16))throw failure('ENVIRONMENT_CATALOG_INVALID','应用运行环境分发清单无效');
    const entries=new Map((catalog?.packages||[]).map(entry=>[environmentKey(entry.requirement),entry]));
    const store=createRuntimeEnvironments({root:installationRoot,activeRoot:activeInstallationRoot,owner,onProgress,provider:{
        async resolve(requirement){const entry=entries.get(environmentKey(requirement));if(!entry)throw failure('ENVIRONMENT_NOT_AVAILABLE','应用没有提供适用的运行环境，请修复或更新安装；已有数据已保留');return {manifest:entry.manifest,source:inside(root,path.resolve(root,entry.source))};},
        async verify(manifest){const entry=entries.get(manifest.id);return !!entry&&JSON.stringify(entry.manifest)===JSON.stringify(manifest);},
    }});
    return {
        acquire(requirement){
            if(closing)return Promise.reject(failure('APPLICATION_CLOSED','应用已关闭'));
            if(!entries.has(environmentKey(requirement)))return Promise.reject(failure('ENVIRONMENT_UNDECLARED','应用没有声明此运行环境要求'));
            const task=store.acquire(application.id,requirement).then(lease=>{active.add(lease);if(closing)throw failure('APPLICATION_CLOSED','应用已关闭');return lease;});
            pending.add(task);task.then(()=>pending.delete(task),()=>pending.delete(task));return task;
        },
        leases:store.leases,
        async dispose(){
            if(disposed)return;
            closing=true;if(disposing)return disposing;
            disposing=(async()=>{
                await Promise.allSettled([...pending]);let firstError;
                for(const lease of active)try{await lease.release();active.delete(lease);}catch(error){firstError||=error;}
                if(firstError)throw firstError;
                disposed=true;
            })();
            try{await disposing;}finally{disposing=null;}
        },
    };
}
module.exports={createApplicationRuntimeScope};
