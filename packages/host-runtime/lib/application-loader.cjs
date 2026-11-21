'use strict';
const path=require('node:path');
const {createApplicationModules}=require('@cxx/host-runtime/application-modules');
const {failure}=require('@cxx/host-runtime/files');
const {createExternalModuleLoader}=require('./external-module-loader.cjs');


/** 业务释放完成后仅重试环境收尾，失败资源仍由宿主持有。 */
function manageApplication(application,runtimes) {
    let released=false;
    return {load:application?.load,async dispose(){try{if(!released){await application?.dispose?.();released=true;}}finally{await runtimes?.dispose();}}};
}

/** 外部产品通过已登记的公开应用入口接入，不复制产品内部实现。 */
function createExternalApplications({runtime,electron,processScope,hostContext,report=console.error,installationRoot=()=>path.join(runtime.environment.root,'installation'),activeInstallationRoot=installationRoot,access,projectAccess}) {
    let registry=createApplicationModules(runtime.environment);
    const modules=createExternalModuleLoader();
    const active=new Map(),loading=new Map(),closing=new Set(),closingTasks=new Map(),failedClose=new Set();let disposed=false;
    const refresh=()=>{registry=createApplicationModules(runtime.environment);return registry;};
    const finish=task=>task.catch(error=>{if(error.code!=='APPLICATION_CLOSED'&&error.name!=='AbortError')report(error);});
    const api={
        list:()=>refresh().list(),
        async initializeProject(id, project, configuration, signal) {
            const record = refresh().resolve(id);
            const exported = modules.load(record);
            try {
                if (typeof exported.initializeProject !== 'function') return { status: 'not-supported', message: '此应用未提供项目初始化接口，可在应用内继续使用' };
                return await exported.initializeProject({ project, configuration, signal, environment: runtime.environment, root: record.root });
            } finally { if (!active.has(id) && !loading.has(id)) modules.release(id); }
        },
        async cleanupProject(id, project, taskId, signal, onProgress) {
            signal.throwIfAborted();
            const record = refresh().resolve(id);
            const exported = modules.load(record);
            try {
                if (typeof exported.cleanupProject !== 'function') throw failure('PROJECT_CLEANUP_UNAVAILABLE', '此版本未提供项目清理，请更新应用后重试');
                const result = await exported.cleanupProject({ project, taskId, signal, onProgress, environment: runtime.environment, root: record.root });
                if (result?.success !== true) throw failure('PROJECT_CLEANUP_INCOMPLETE', '应用未完成数据清理，请核对应用后重试');
            } finally { if (!active.has(id) && !loading.has(id)) modules.release(id); }
        },
        descriptor(id,definition) {
            definition ||= refresh().list().find(entry=>entry.id===id);
            if(!definition)throw failure('MODULE_NOT_REGISTERED','应用尚未登记');
            return {...definition,sandbox:true,partition:'persist:'+id,preload:path.resolve(definition.root,definition.preload),
                async load(view) {
                    const previousClose=closingTasks.get(id);
                    if(previousClose)await previousClose;
                    if(failedClose.has(id))await api.closed(id);
                    if(disposed||view.webContents.isDestroyed())throw failure('APPLICATION_CLOSED','应用已关闭');
                    const controller=new AbortController();
                    const task=Promise.resolve().then(async()=>{
                    if(controller.signal.aborted)throw failure('APPLICATION_CLOSED','应用已关闭');
                    const record=refresh().resolve(id);
                    if(record.root!==definition.root||record.version!==definition.version||record.entry!==path.resolve(definition.root,definition.entry)
                        ||record.preload!==path.resolve(definition.root,definition.preload)||record.entryDigest!==definition.entryDigest
                        ||record.preloadDigest!==definition.preloadDigest||record.runtimePackagesDigest!==definition.runtimePackagesDigest)
                        throw failure('MODULE_CHANGED','应用已更新，请核对后重新打开');
                    let instance,runtimes,managed=false;
                    try {
                        const exported=modules.load(record);
                        if(typeof exported.createApplication!=='function')throw failure('MODULE_CONTRACT_INVALID','应用没有实现公开宿主装配入口');
                        runtimes=require('@cxx/host-runtime/application-runtimes').createApplicationRuntimeScope({root:record.root,application:record,owner:runtime.environment.owner,
                            installationRoot:installationRoot(),activeInstallationRoot});
                        instance=await exported.createApplication({environment:runtime.environment,electron,report,host:hostContext?.(id),root:record.root,runtimes,signal:controller.signal,access:access?.(id),projects:projectAccess?.(id),processes:processScope?.(definition)});
                        if(typeof instance?.load!=='function'||typeof instance?.dispose!=='function')throw failure('MODULE_CONTRACT_INVALID','应用未提供加载和释放能力');
                        const application=instance;instance=manageApplication(application,runtimes);managed=true;
                        if(disposed||controller.signal.aborted||view.webContents.isDestroyed())throw failure('APPLICATION_CLOSED','应用已关闭');
                        active.set(id,instance);await application.load(view);
                        if(disposed||controller.signal.aborted||view.webContents.isDestroyed())throw failure('APPLICATION_CLOSED','应用已关闭');
                    }catch(error){
                        const cleanup=managed?instance:manageApplication(instance,runtimes);
                        try{await cleanup.dispose();active.delete(id);modules.release(id);}
                        catch(cleanupError){active.set(id,cleanup);failedClose.add(id);cleanupError.cause||=error;throw cleanupError;}
                        throw error;
                    }
                    });
                    loading.set(id,{task,controller});
                    try{await task;}finally{if(loading.get(id)?.task===task)loading.delete(id);}
                }};
        },
        async closed(id) {
            if(closingTasks.has(id))return closingTasks.get(id);
            const pending=loading.get(id);pending?.controller.abort(failure('APPLICATION_CLOSED','应用已关闭'));
            const task=Promise.resolve().then(async()=>{
                if(pending)await finish(pending.task);const current=active.get(id);
                try{await current?.dispose();active.delete(id);modules.release(id);failedClose.delete(id);}
                catch(error){failedClose.add(id);throw error;}
            });
            closing.add(task);closingTasks.set(id,task);
            try{await task;}finally{closing.delete(task);closingTasks.delete(id);}
        },
        async waitClosed() {await Promise.all([...closing]);for(const id of [...failedClose])await api.closed(id);},
        async destroy() {
            disposed=true;const pending=[...loading.values()];for(const entry of pending)entry.controller.abort(failure('APPLICATION_CLOSED','应用宿主已关闭'));
            await Promise.allSettled(pending.map(entry=>finish(entry.task)));
            const current=[...active.entries()];active.clear();for(const [id,instance] of current)try{await instance.dispose();}catch(error){report(error);}finally{modules.release(id);}await Promise.allSettled([...closing]);
        },
    };
    return api;
}
module.exports={createExternalApplications};
