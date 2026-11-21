'use strict';
const LOGIN_TIMEOUT_MS = 120_000;

/** 使用独立原生视图完成标准授权，不向远程页面注入产品桥或Node能力。 */
function createNativeAuthorization({ electron, partition, createWindow = options => new electron.BrowserWindow(options) }) {
    let active, closed = false;
    const session = electron.session.fromPartition(partition);
    session.setPermissionRequestHandler((_contents, _permission, answer) => answer(false));
    session.setPermissionCheckHandler(() => false);

    /** 只允许固定认证服务及精确回调路径，回调内容继续由SDK验证。 */
    function authorize({ url, issuer, redirectUri, signal, title = '登录 CXX 账户' }) {
        if (closed) return Promise.reject(Object.assign(new Error('账户会话已关闭'), { code: 'LOGIN_CANCELLED' }));
        if (active && !active.window.isDestroyed()) { active.window.show(); active.window.focus(); return active.task; }
        const expected = new URL(redirectUri), trusted = new URL(issuer);
        const initial = new URL(url);
        if (initial.origin !== trusted.origin || initial.username || initial.password || initial.hash) {
            return Promise.reject(Object.assign(new Error('请核对账户服务的固定授权地址'), { code: 'ACCOUNT_CONFIGURATION_REQUIRED' }));
        }
        const window = createWindow({ width: 520, height: 740, minWidth: 380, minHeight: 520,
            title, show: false, autoHideMenuBar: true, webPreferences: { session, nodeIntegration: false, contextIsolation: true, sandbox: true } });
        const task = new Promise((resolve, reject) => {
            let finished = false;
            const finish = (error, value) => {
                if (finished) return; finished = true;
                clearTimeout(timer); signal?.removeEventListener('abort', cancelled);
                window.removeListener('closed', cancelled);
                if (!window.isDestroyed()) window.destroy();
                if (error) reject(error); else resolve(value);
            };
            const cancelled = () => finish(Object.assign(new Error('登录已取消，可以随时重新登录'), { code: 'LOGIN_CANCELLED' }));
            const timer = setTimeout(() => finish(Object.assign(new Error('登录等待已结束，请重新登录'), { code: 'LOGIN_CANCELLED' })), LOGIN_TIMEOUT_MS);
            const navigate = (event, target, _inPlace, isMainFrame) => {
                if (event.isMainFrame === false || isMainFrame === false) { event.preventDefault(); return; }
                let parsed; try { parsed = new URL(target); } catch { event.preventDefault(); return; }
                if (parsed.origin === expected.origin && parsed.pathname === expected.pathname && !parsed.hash && !parsed.username && !parsed.password) {
                    event.preventDefault(); finish(null, parsed.href); return;
                }
                if (parsed.origin !== trusted.origin || parsed.username || parsed.password) event.preventDefault();
            };
            window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
            window.webContents.on('will-navigate', navigate);
            window.webContents.on('will-redirect', navigate);
            window.webContents.on('did-navigate', (_event, _target, status) => {
                if (status >= 400) finish(Object.assign(new Error('账户接入尚未完成，请检查客户端编号与登记回调后重试登录'), { code: 'ACCOUNT_CONFIGURATION_REQUIRED' }));
            });
            window.webContents.on('did-fail-load', (_event, code) => {
                if (code !== -3) finish(Object.assign(new Error('账户页面暂时无法打开，请检查连接后重试'), { code: 'ACCOUNT_UNAVAILABLE' }));
            });
            window.once('closed', cancelled); signal?.addEventListener('abort', cancelled, { once: true });
            if (signal?.aborted) { cancelled(); return; }
            window.loadURL(url).then(() => { if (!finished && !window.isDestroyed()) { window.show(); window.focus(); } })
                .catch(() => finish(Object.assign(new Error('账户页面暂时无法打开，请检查连接后重试'), { code: 'ACCOUNT_UNAVAILABLE' })));
        });
        active = { window, task };
        task.finally(() => { if (active?.task === task) active = undefined; }).catch(() => {});
        return task;
    }
    return { authorize, session,
        destroy() { if (closed) return; closed = true; if (active && !active.window.isDestroyed()) active.window.close(); } };
}
module.exports = { createNativeAuthorization };
