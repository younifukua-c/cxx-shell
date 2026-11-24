'use strict';
const {createApplicationSessions}=require('./application-sessions.cjs');
const {failure}=require('./files.cjs');

/** 应用清单与原生视图通过端口组装，一个应用只保留一个活动会话。 */
function createApplicationHost({viewHost,applications,beforeOpen=async()=>{},canOpen=()=>true,canCombine=()=>true,persist=()=>{},onChanged=()=>{}}) {
    const catalog=new Map(),active=new Map(),opening=new Map();
    let disposed=false,removing=false;
    if(!Array.isArray(applications)||applications.length>200) throw failure('APPLICATION_LIMIT','应用清单超过上限');
    function register(entry) {
        if(catalog.size>=200)throw failure('APPLICATION_LIMIT','应用清单超过上限');
        if(!/^[a-z][a-z0-9-]{0,63}$/.test(entry.id)||catalog.has(entry.id)||!entry.name||typeof entry.load!=='function') throw failure('APPLICATION_INVALID','应用标识、名称或加载入口无效');
        catalog.set(entry.id,entry);
    }
    for(const entry of applications)register(entry);
    const sessions=createApplicationSessions({viewHost,canCombine,persist:value=>{persist(value);onChanged(value,removing?'closed':'changed');}});
    const get=id=>{
        if(disposed) throw failure('HOST_CLOSED','应用宿主已退出');
        const entry=catalog.get(id);if(!entry)throw failure('APPLICATION_UNKNOWN','应用尚未安装，请到应用中心查看');
        if(!canOpen(id))throw failure('APPLICATION_DISABLED','应用尚未启用，请到应用中心启用');
        return entry;
    };
    const session=id=>sessions.list().find(item=>item.applicationId===id);
    return {
        register,
        unregister(id) {if(active.has(id)||opening.has(id))throw failure('APPLICATION_IN_USE','请先保存并关闭此应用');catalog.delete(id);},
        list:()=>sessions.list(),
        async focus(id) {
            if (disposed) throw failure('HOST_CLOSED', '应用宿主已退出');
            const current = active.get(id);
            if (current) await viewHost.focus(current, session(id).windowId);
        },
        async open(id,{windowId,activate=true}={}) {
            if(opening.has(id)) return opening.get(id);
            const task=Promise.resolve().then(async()=>{
                await beforeOpen(id);
                const entry=get(id),existing=active.get(id);
                if(existing) {if(activate)await viewHost.focus(existing,session(id).windowId);return session(id);}
                const target=windowId===undefined?await viewHost.createWindow(id):windowId;
                let current;
                try {
                    const view=viewHost.createView(entry);
                    const sessionId=sessions.register({applicationId:id,windowId:target,view});
                    current={id:sessionId,applicationId:id,view};active.set(id,current);
                    await viewHost.attach(current,target);
                    await entry.load(view);
                    if(disposed)throw failure('HOST_CLOSED','加载期间宿主已退出');
                    await viewHost.confirm(current,target);if(activate)await viewHost.focus(current,target);
                    return session(id);
                } catch(error) {
                    if(current) {
                        active.delete(id);sessions.unregister(current.id);
                        if(!current.view.webContents.isDestroyed())current.view.webContents.close({waitForBeforeUnload:false});
                    }
                    await viewHost.closeEmpty(target);throw error;
                }
            });
            opening.set(id,task);
            try {return await task;} finally {opening.delete(id);}
        },
        async merge(id,targetWindow) {
            get(id);const current=session(id);
            if(!current) throw failure('SESSION_NOT_FOUND','请先打开需要合并的应用');
            await sessions.merge(current.id,targetWindow);return session(id);
        },
        async mergeWindow(windowId,targetWindow) {
            const selected=sessions.list().filter(item=>item.windowId===windowId);
            if(!selected.length)throw failure('SESSION_NOT_FOUND','源窗口已经关闭');
            for(const item of selected)get(item.applicationId);
            await sessions.mergeMany(selected.map(item=>item.id),targetWindow);
        },
        async split(id) {
            get(id);const current=session(id);
            if(!current) throw failure('SESSION_NOT_FOUND','应用尚未打开');
            if(sessions.list().filter(item=>item.windowId===current.windowId).length<2) return current;
            await sessions.split(current.id);return session(id);
        },
        closed(view) {
            if(disposed)return;
            const current=[...active.values()].find(item=>item.view===view);if(!current)return;
            active.delete(current.applicationId);
            removing=true;try {sessions.unregister(current.id);}finally{removing=false;}
        },
        applicationOf(contents) {return [...active.values()].find(item=>item.view.webContents===contents)?.applicationId||null;},
        contents(id) {return active.get(id)?.view.webContents||null;},
        eligibilityChanged:allowed=>sessions.eligibilityChanged(allowed),
        destroy() {if(disposed)return;disposed=true;viewHost.destroy();active.clear();},
    };
}
module.exports={createApplicationHost};
