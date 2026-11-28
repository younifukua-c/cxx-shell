'use strict';
const {failure}=require('./files.cjs');

/** 原生窗口只承载视图；视图由会话持有，移动时不重新加载页面。 */
function createElectronViewHost({electron,windowOptions,onViewClosed=()=>{},onWindowsChanged=()=>{},onWindowCreated=()=>{},onWindowMoved=()=>{},beforeClose=async()=>true,report=()=>{}}) {
    const windows=new Map(),owners=new Map(),views=new Set(),applicationIds=new WeakMap();
    let disposed=false;
    const get=id=>{
        const record=windows.get(id);
        if(!record||record.window.isDestroyed()) throw failure('WINDOW_UNAVAILABLE','目标窗口已关闭，应用保留在原窗口');
        return record;
    };
    const resize=record=>{
        // Windows 最小化可能返回零客户区，保留有效视图尺寸并在恢复时重排。
        if(record.window.isDestroyed()||record.window.isMinimized()) return;
        const bounds=record.window.getContentBounds();
        if(bounds.width<=0||bounds.height<=0) return;
        for(const view of record.views) view.setBounds({x:0,y:0,width:bounds.width,height:bounds.height});
    };
    const activateView=(record,view)=>{
        record.active=view;
        if(!view)return;
        view.setVisible(true);
        const options=windowOptions(applicationIds.get(view));
        if(typeof options.title==='string')record.window.setTitle?.(options.title);
        if(options.icon) {
            try {record.window.setIcon?.(options.icon);}
            catch(error) {report(error);}
        }
        return options;
    };
    const closeEmpty=id=>{
        const record=windows.get(id);
        if(!record||record.views.size||record.window.isDestroyed()) return;
        record.allowClose=true;record.window.close();
    };
    return {
        createWindow(applicationId) {
            if(disposed) throw failure('HOST_CLOSED','应用宿主已退出');
            if(windows.size>=128) throw failure('WINDOW_LIMIT','打开的窗口过多，请先关闭不需要的窗口');
            const window=new electron.BaseWindow({...windowOptions(applicationId),show:false});
            const id=window.id;
            const record={window,views:new Set(),active:null,allowClose:false,closing:false};
            windows.set(id,record);
            window.on('resize',()=>resize(record));
            window.on('restore',()=>resize(record));
            window.on('show',()=>resize(record));
            let userMoving=false;
            window.on('will-move',()=>{userMoving=true;});
            window.on('moved',()=>{if(userMoving){userMoving=false;onWindowMoved(window);}});
            window.on('close',event=>{
                if(record.allowClose||!record.views.size) return;
                event.preventDefault();
                if(record.closing)return;record.closing=true;
                (async()=>{
                    const owned=[...record.views];
                    for(const view of owned)if(!view.webContents.isDestroyed()&&!await beforeClose(view.webContents))return;
                    if(owned.some(view=>owners.get(view)!==id))throw failure('WINDOW_CONTENT_CHANGED','应用正在切换窗口，请稍后关闭');
                    for(const view of owned)if(!view.webContents.isDestroyed())view.webContents.close({waitForBeforeUnload:false});
                })().catch(report).finally(()=>{record.closing=false;});
            });
            window.once('closed',()=>{windows.delete(id);onWindowsChanged();});
            onWindowCreated(window);onWindowsChanged();return id;
        },
        createView({id:applicationId,preload,partition,sandbox=false}) {
            if(disposed) throw failure('HOST_CLOSED','应用宿主已退出');
            const view=new electron.WebContentsView({webPreferences:{preload,partition,contextIsolation:true,nodeIntegration:false,sandbox}});
            views.add(view);applicationIds.set(view,applicationId);
            view.webContents.setWindowOpenHandler(()=>({action:'deny'}));
            view.webContents.on('will-navigate',event=>event.preventDefault());
            view.webContents.once('destroyed',()=>{
                views.delete(view);const id=owners.get(view);owners.delete(view);
                const record=windows.get(id);record?.views.delete(view);
                onViewClosed(view);
                if(record?.active===view) {
                    activateView(record,[...record.views][0]||null);
                }
                if(id!==undefined) closeEmpty(id);
            });
            return view;
        },
        async attach(session,id) {
            const target=get(id),view=session.view;
            if(target.closing)throw failure('WINDOW_CLOSING','目标窗口正在关闭，应用保留在原窗口');
            if(!views.has(view)||view.webContents.isDestroyed()) throw failure('VIEW_UNAVAILABLE','应用页面已关闭');
            const previous=windows.get(owners.get(view));
            if(previous===target) return;
            if(previous) {
                view.webContents.emit('cxx-account-surface-detached');
                previous.window.contentView.removeChildView(view);previous.views.delete(view);
                if(previous.active===view)activateView(previous,[...previous.views][0]||null);
            }
            target.window.contentView.addChildView(view);target.views.add(view);owners.set(view,id);
            view.setVisible(false);resize(target);
        },
        async confirm(session,id) {
            get(id);
            if(owners.get(session.view)!==id||session.view.webContents.isDestroyed()) throw failure('VIEW_TRANSFER_FAILED','页面未能接入目标窗口');
        },
        async focus(session,id) {
            const record=get(id);await this.confirm(session,id);
            if(record.active&&record.active!==session.view)record.active.webContents.emit('cxx-account-surface-detached');
            for(const view of record.views) view.setVisible(view===session.view);
            const options=activateView(record,session.view);
            if(record.window.isMinimized()) record.window.restore();
            if(options.show!==false) {record.window.show();record.window.focus();}
            resize(record);
            session.view.webContents.focus();
        },
        closeEmpty,
        report,
        windowOf(contents) {const view=[...views].find(item=>item.webContents===contents);return windows.get(owners.get(view))?.window||null;},
        activeWindowOf(contents) {const view=[...views].find(item=>item.webContents===contents);const record=windows.get(owners.get(view));return record?.active===view?record.window:null;},
        windows:()=>[...windows.values()].map(record=>record.window),
        contents:()=>[...views].map(view=>view.webContents),
        window(id) {return get(id).window;},
        dropTarget(source,point) {
            return [...windows.values()].reverse().find(record=>{
                if(record.window.id===source||record.window.isDestroyed()||!record.window.isVisible()||record.window.isMinimized())return false;
                const bounds=record.window.getBounds();
                return point.x>=bounds.x&&point.x<=bounds.x+bounds.width&&point.y>=bounds.y&&point.y<=bounds.y+48;
            })?.window||null;
        },
        destroy() {
            if(disposed) return;disposed=true;
            for(const view of [...views]) if(!view.webContents.isDestroyed()) view.webContents.close({waitForBeforeUnload:false});
            for(const record of windows.values()) if(!record.window.isDestroyed()) {record.allowClose=true;record.window.close();}
            windows.clear();owners.clear();views.clear();
        },
    };
}
module.exports={createElectronViewHost};
