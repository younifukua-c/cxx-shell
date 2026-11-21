'use strict';
const { EventEmitter } = require('node:events');
const { AsyncLocalStorage } = require('node:async_hooks');
const { failure } = require('../files.cjs');
const THEMES = new Set(['dark', 'light', 'glass', 'neutral', 'gilded']);
const PAGES = new Set(['login', 'logout', 'store', 'website', 'preferences']);

/** 账户远程页面仅覆盖所属应用的内容区，没有 preload、产品桥或 Node 权限。 */
function createAccountWorkspace({ electron, windowOf }) {
    const scope = new AsyncLocalStorage();
    let current, disposed = false;

    /** 界面只指定逻辑页面及客户区坐标，不接收 URL 或浏览器选项。 */
    function validate(input) {
        if (!input || typeof input.id !== 'string' || !/^[a-zA-Z0-9_-]{1,96}$/.test(input.id)
            || !PAGES.has(input.page) || !THEMES.has(input.theme)) {
            throw failure('ACCOUNT_REQUEST_INVALID', '请重新打开账户页面');
        }
        const rect = input.bounds;
        if (!rect || !['x', 'y', 'width', 'height'].every(key => Number.isFinite(rect[key]))
            || rect.x < 0 || rect.y < 0 || rect.width < 0 || rect.height < 0) {
            throw failure('ACCOUNT_REQUEST_INVALID', '页面尺寸尚未就绪，请重新打开');
        }
    }

    /** 在原生客户区内裁切；浏览器缩放通过所属页面倍率统一换算。 */
    function layout(record) {
        if (!record.view || record.window.isDestroyed() || record.owner.isDestroyed()) return;
        const area = record.window.getContentBounds(), zoom = record.owner.getZoomFactor?.() || 1;
        if (area.width <= 0 || area.height <= 0) return;
        const x = Math.min(area.width, Math.round(record.input.bounds.x * zoom));
        const y = Math.min(area.height, Math.round(record.input.bounds.y * zoom));
        record.view.setBounds({ x, y, width: Math.max(0, Math.min(area.width - x, Math.round(record.input.bounds.width * zoom))),
            height: Math.max(0, Math.min(area.height - y, Math.round(record.input.bounds.height * zoom))) });
        record.view.setVisible(record.shown === true && record.input.bounds.width > 0 && record.input.bounds.height > 0);
    }

    /** 只关闭属于本次请求的视图；迟到的取消不能关闭下一次登录。 */
    function release(record) {
        if (!record || record.closed) return;
        record.closed = true;
        if (current === record) current = undefined;
        record.controller.abort();
        record.owner.removeListener('destroyed', record.cancel);
        record.owner.removeListener('cxx-account-surface-detached', record.cancel);
        record.window.removeListener('closed', record.cancel);
        record.window.removeListener('resize', record.resize);
        record.window.removeListener('restore', record.resize);
        record.surface?.destroy();
    }

    /** 主题提示没有认证意义，只发送到当前可信页面自身的 Cookie 域。 */
    async function presentation(record, session, url) {
        const origin = new URL(url).origin;
        for (const [name, value] of [['cxx-desktop-surface', 'workspace'], ['cxx-desktop-theme', record.input.theme]]) {
            await session.cookies.set({ url: origin, name, value, path: '/', sameSite: 'lax', secure: origin.startsWith('https:') });
        }
    }

    /** 兼容标准授权窗口端口，认证状态机仍由原授权适配器管理。 */
    function createWindow(options) {
        const record = scope.getStore();
        if (!record) return new electron.BrowserWindow(options);
        if (record.closed || disposed || record.owner.isDestroyed()) throw failure('LOGIN_CANCELLED', '账户页面已关闭');
        record.surface?.destroy();
        const view = new electron.WebContentsView({ webPreferences: {
            session: options.webPreferences.session, sandbox: true, contextIsolation: true, nodeIntegration: false,
        } });
        const surface = new EventEmitter();
        let destroyed = false;
        record.view = view; record.surface = surface; record.shown = false;
        view.setVisible(false); record.window.contentView.addChildView(view); layout(record);
        Object.assign(surface, {
            webContents: view.webContents,
            isDestroyed: () => destroyed,
            async loadURL(url) {
                await presentation(record, options.webPreferences.session, url);
                if (record.closed || destroyed) throw failure('LOGIN_CANCELLED', '账户页面已关闭');
                return view.webContents.loadURL(url);
            },
            show() { if (!destroyed && !record.closed) { record.shown = true; layout(record); } },
            focus() { if (!destroyed && !record.closed) view.webContents.focus(); },
            close() { surface.destroy(); },
            destroy() {
                if (destroyed) return; destroyed = true;
                if (!record.window.isDestroyed()) record.window.contentView.removeChildView(view);
                if (!view.webContents.isDestroyed()) view.webContents.close({ waitForBeforeUnload: false });
                if (record.view === view) record.view = undefined;
                surface.emit('closed');
            },
        });
        view.webContents.once('render-process-gone', () => release(record));
        return surface;
    }

    return {
        createWindow,
        async open(owner, input, action) {
            validate(input);
            const window = windowOf(owner);
            if (disposed || !window || window.isDestroyed() || owner.isDestroyed()) throw failure('ACCOUNT_CLOSED', '请在当前软件中重新打开账户页面');
            if (current && current.owner !== owner && ['login', 'logout'].includes(current.input.page)) {
                throw failure('ACCOUNT_BUSY', '另一软件正在完成账户验证，请先完成或关闭原账户页面后重试');
            }
            release(current);
            const record = { owner, window, input: { ...input, bounds: { ...input.bounds } }, controller: new AbortController() };
            record.cancel = () => release(record); record.resize = () => layout(record);
            current = record;
            owner.once('destroyed', record.cancel); owner.once('cxx-account-surface-detached', record.cancel);
            window.once('closed', record.cancel); window.on('resize', record.resize); window.on('restore', record.resize);
            try { return await scope.run(record, () => action(record.controller.signal)); }
            catch (error) { release(record); throw error; }
            finally { if (input.page === 'login' || input.page === 'logout') release(record); }
        },
        resize(owner, input) {
            if (current?.owner !== owner || current.input.id !== input.id) return;
            validate({ ...current.input, ...input });
            current.input = { ...current.input, bounds: { ...input.bounds }, theme: input.theme };
            layout(current);
        },
        close(owner, id) { if (current?.owner === owner && current.input.id === id) release(current); },
        destroy() { disposed = true; release(current); },
    };
}
module.exports = { createAccountWorkspace };
