'use strict';

/** 安全桥仅转发白名单协议；Electron 与通道由宿主注入，包不加载产品模块。 */
function installHostBridge({contextBridge,ipcRenderer,channels:C}) {
    let closeGuard=null;
    let signInSerial=0;
    const subscribe=(channel,listener,map=value=>value)=>{
        const handler=(_event,value)=>listener(map(value));ipcRenderer.on(channel,handler);
        return()=>ipcRenderer.removeListener(channel,handler);
    };
    const accountAction = async (action, applicationId, extra = {}) => {
        const result = await ipcRenderer.invoke(C.APPLICATION_HOST, { action, applicationId, ...extra });
        if (!result?.success) throw Object.assign(new Error(result?.error || '请检查账户连接后重试，资料和草稿保留'), { code: result?.code });
        return result.value;
    };
    ipcRenderer.on(C.APPLICATION_HOST_CLOSING,async(_event,{id})=>{
        let allow=false;
        try{allow=closeGuard?await closeGuard():true;}catch(error){console.error('[close-guard]',error);}
        await ipcRenderer.invoke(C.APPLICATION_HOST,{action:'close-answer',id,allow});
    });
    contextBridge.exposeInMainWorld('cxxHost',{
        setCloseGuard:guard=>{closeGuard=guard;return()=>{if(closeGuard===guard)closeGuard=null;};},
        request:input=>ipcRenderer.invoke(C.APPLICATION_HOST,input),
        onChanged:listener=>subscribe(C.APPLICATION_HOST_CHANGED,listener),
        account: {
            request: input => {
                if (!['account-read', 'account-sign-in', 'account-cancel-sign-in', 'account-sign-out', 'account-store', 'account-register', 'account-workspace-open', 'account-workspace-resize', 'account-workspace-close'].includes(input?.action)) {
                    return Promise.resolve({ success: false, code: 'ACCOUNT_REQUEST_INVALID', error: '请从个人中心选择账户操作' });
                }
                return ipcRenderer.invoke(C.APPLICATION_HOST, input);
            },
            read: async signal => {
                const value = await accountAction('account-read');
                if (signal?.aborted) throw Object.assign(new Error('读取已取消'), { code: 'LOGIN_CANCELLED' });
                return value;
            },
            signIn: async () => {
                const id = 'login-' + ++signInSerial;
                return accountAction('account-sign-in', undefined, { id });
            },
            signOut: () => accountAction('account-sign-out'),
            openStore: applicationId => accountAction('account-store', applicationId),
            onChanged: listener => subscribe(C.APPLICATION_HOST_CHANGED, value => {
                // 已核验的资格变化也要同步其他视图；资格控制器只在业务状态改变时发布。
                if (value.kind === 'account' || value.kind === 'guidance' || value.kind === 'access') {
                    const invalidate = value.kind === 'access' && ['ACCOUNT_CHANGED', 'CLOSED'].includes(value.reason);
                    listener({ invalidate });
                }
            }),
        },
        window:{minimize:()=>ipcRenderer.invoke(C.WINDOW_MINIMIZE),close:()=>ipcRenderer.invoke(C.WINDOW_CLOSE),
            toggleMaximize:()=>ipcRenderer.invoke(C.WINDOW_TOGGLE_MAXIMIZE).then(value=>value.maximized),
            isMaximized:()=>ipcRenderer.invoke(C.WINDOW_IS_MAXIMIZED).then(value=>value.maximized),
            onMaximizedChange:listener=>subscribe(C.WINDOW_MAXIMIZE_CHANGED,listener,value=>value.maximized)},
    });
}
module.exports={installHostBridge};
