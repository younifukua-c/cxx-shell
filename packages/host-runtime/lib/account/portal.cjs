'use strict';

/** 官网只在没有产品桥的独立页面打开，沿用同一环境的认证Cookie。 */
function createAccountPortal({ electron, session, origin, onClosed = () => {}, createWindow = options => new electron.BrowserWindow(options) }) {
    let current, disposed = false;
    const trusted = new URL(origin).origin;

    /** 导航目标由账户适配器生成，页面不能要求打开任意本机地址。 */
    async function open(url) {
        if (disposed || new URL(url).origin !== trusted) throw Object.assign(new Error('请重新从个人中心打开官网'), { code: 'ACCOUNT_CONFIGURATION_REQUIRED' });
        if (current && !current.isDestroyed()) { await current.loadURL(url); current.show(); current.focus(); return; }
        const window = createWindow({ width: 1120, height: 820, minWidth: 390, minHeight: 540,
            title: 'CXX 软件与订阅', show: false, autoHideMenuBar: true,
            webPreferences: { session, nodeIntegration: false, contextIsolation: true, sandbox: true } });
        current = window;
        window.once('closed', () => { if (current === window) current = null; if (!disposed) onClosed(); });
        const navigate = (event, target) => {
            try { const parsed = new URL(target); if (parsed.origin !== trusted || parsed.username || parsed.password) event.preventDefault(); }
            catch { event.preventDefault(); }
        };
        window.webContents.on('will-navigate', navigate);
        window.webContents.on('will-redirect', navigate);
        window.webContents.setWindowOpenHandler(({ url: target }) => {
            try {
                const parsed = new URL(target);
                if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) {
                    electron.shell.openExternal(parsed.href).catch(() => {});
                }
            } catch { /* 非网络地址不交给系统关联程序。 */ }
            return { action: 'deny' };
        });
        try { await window.loadURL(url); if (!window.isDestroyed()) window.show(); }
        catch {
            if (!window.isDestroyed()) window.destroy();
            throw Object.assign(new Error('官网暂时无法连接，请确认官网服务已启动后重试'), { code: 'ACCOUNT_UNAVAILABLE' });
        }
    }
    const close = () => { if (current && !current.isDestroyed()) current.destroy(); current = null; };
    return { open, close, destroy() { disposed = true; close(); } };
}
module.exports = { createAccountPortal };
