'use strict';
const { createApplicationAccess } = require('../application-access.cjs');
const { createNativeAuthorization } = require('./native-authorization.cjs');
const { createAccountPortal } = require('./portal.cjs');
const { createAccountWorkspace } = require('./workspace.cjs');
const ACCOUNT_RECHECK_MS = 20_000;

/** 账户与软件资格的装配；公共基建绕过商业门禁，产品业务必须经过实时核验。 */
function createDesktopAccount({ electron, environment, configuration, createProvider, listApplications, windowOf, onChanged = () => {}, onDiagnostic = () => {}, setTimer = setTimeout, clearTimer = clearTimeout }) {

    let authorization, portal;
    let disposed = false, access;
    let registered = new Map();
    let providerTask;
    const workspace = windowOf ? createAccountWorkspace({ electron, windowOf }) : undefined;
    let recheckTimer, rechecking, monitoring = false, lastRecheckFailure;
    const session = () => providerTask ||= Promise.resolve().then(() => {
        if (disposed) throw Object.assign(new Error('账户会话已关闭'), { code: 'ACCOUNT_CLOSED' });
        const connection = typeof configuration === 'function' ? configuration() : configuration;
        authorization ||= createNativeAuthorization({ electron, partition: 'persist:cxx-identity-' + environment.id, createWindow: workspace?.createWindow });
        portal ||= createAccountPortal({ electron, session: authorization.session, origin: connection.websiteOrigin,
            createWindow: workspace?.createWindow, onClosed: () => { if (!disposed) void recheck(); } });
        return createProvider({ configuration: connection, listApplications: () => [...registered.values()],
            authorize: authorization.authorize, openStore: portal.open,
            onChanged: () => { if (!disposed) { access.reset(); onChanged({ kind: 'account' }); } } });
    }).catch(error => { providerTask = undefined; throw error; });
    const provider = { check: async (ids, signal) => (await session()).check(ids, signal) };
    const available = () => [...registered.values()].filter(item => !item.infrastructure && !item.demo).map(item => item.id);
    access = createApplicationAccess({ provider,
        onChanged: (ids, reason) => {
            if (disposed) return;
            onChanged({ kind: 'access', applicationIds: ids, reason });
            if (reason === 'RECHECK_REQUIRED') void access.refresh(ids.filter(id => registered.has(id))).catch(error => diagnostic('refresh', error));
        } });

    /** 诊断只记录动作及分类，不记录回调、令牌、URL或供应商响应正文。 */
    function diagnostic(operation, error) {
        onDiagnostic({ operation, code: classification(error) });
    }

    /** 分类码有界且不携带供应商原始文本。 */
    function classification(error) {
        return typeof error?.code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(error.code) ? error.code : 'ACCOUNT_UNAVAILABLE';
    }

    /** 公共基建和随包演示不进入收费资格查询。 */
    function infrastructure(id) {
        const entry = registered.get(id);
        return !!entry && (entry.infrastructure === true || entry.demo === true);
    }

    /** 用例边界只读一次可信软件集合，逐行状态及提供者映射均使用内存快照。 */
    function updateApplications() {
        if (disposed) throw Object.assign(new Error('账户会话已关闭'), { code: 'ACCOUNT_CLOSED' });
        const values = listApplications();
        if (!Array.isArray(values) || values.length > 200) throw Object.assign(new Error('软件目录暂不可读取，请从软件管理核对登记'), { code: 'ACCOUNT_DIRECTORY_UNAVAILABLE' });
        registered = new Map(values.map(value => [value.id, value.external
            ? { ...value, infrastructure: false, demo: false }
            : { ...value }]));
    }

    /** 当前展示状态来自独立资格控制器，不能复用旧的允许结果。 */
    function status(id) {
        if (disposed || !registered.has(id)) return { allowed: false, reason: disposed ? 'CLOSED' : 'APPLICATION_UNKNOWN' };
        return infrastructure(id) ? { allowed: true, reason: 'FREE' } : access.status(id);
    }

    /** 比较公开状态，不把供应商内部令牌或滑动开发许可写入展示事件。 */
    function visibleState(provider) {
        const value = provider.snapshot();
        return JSON.stringify({ ...value, software: value.software.map(item => ({ ...item,
            allowed: status(item.applicationId).allowed })) });
    }

    /** 后台整批核对购买、续费与连接恢复；一次只允许一个请求，不改变业务动作的实时校验。 */
    async function recheck() {
        if (disposed) return;
        if (rechecking) return rechecking;
        rechecking = Promise.resolve().then(async () => {
            try {
                updateApplications();
                const current = await session(), previous = visibleState(current);
                await access.refresh(available());
                if (!disposed && previous !== visibleState(current)) onChanged({ kind: 'account' });
                lastRecheckFailure = undefined;
            } catch (error) {
                const code = classification(error);
                if (!disposed && lastRecheckFailure !== code) diagnostic('recheck', error);
                lastRecheckFailure = code;
            } finally {
                rechecking = undefined;
                if (!disposed && monitoring) scheduleRecheck();
            }
        });
        return rechecking;
    }

    /** 固定间隔在请求完成后安排，不以界面读取或通知驱动下一轮请求。 */
    function scheduleRecheck() {
        if (recheckTimer) clearTimer(recheckTimer);
        recheckTimer = setTimer(() => { recheckTimer = undefined; void recheck(); }, ACCOUNT_RECHECK_MS);
        recheckTimer?.unref?.();
    }

    /** 软件启动或首次读取后开始监测，结束账户实例时统一释放。 */
    function startMonitoring() {
        if (disposed || monitoring) return;
        monitoring = true;
        scheduleRecheck();
    }

    return {
        status,
        /** 右侧页面使用同一中央认证、商城和账户资料，不接受渲染进程提供的网址。 */
        async openWorkspace(owner, input) {
            if (!workspace) throw Object.assign(new Error('当前宿主不支持账户面板，请更新软件'), { code: 'ACCOUNT_CONFIGURATION_REQUIRED' });
            return workspace.open(owner, input, async signal => {
                updateApplications();
                const provider = await session();
                if (signal.aborted) throw Object.assign(new Error('账户页面已关闭'), { code: 'LOGIN_CANCELLED' });
                if (input.page === 'login') return provider.signIn(signal);
                if (input.page === 'logout') return provider.signOut();
                portal.close();
                if (input.page === 'store') return provider.openStore(input.applicationId);
                const connection = typeof configuration === 'function' ? configuration() : configuration;
                return portal.open(new URL(input.page === 'preferences' ? '/account/security' : '/', connection.websiteOrigin).href);
            });
        },
        resizeWorkspace: (owner, input) => workspace?.resize(owner, input),
        closeWorkspace: (owner, id) => workspace?.close(owner, id),
        /** 未连通时只返回引导状态，保留身份显示与原资料，不使公共入口启动失败。 */
        async snapshot() {
            startMonitoring();
            let issue, current;
            try { updateApplications(); current = await session(); await access.refresh(available()); }
            catch (error) { diagnostic('read', error); issue = { code: 'ACCOUNT_UNAVAILABLE', message: '暂时无法同步软件资料，请检查账户服务连接后刷新；公共基建和原有资料保留。' }; }
            let snapshot;
            try { if (!current) throw Error('Account configuration unavailable'); snapshot = current.snapshot(); }
            catch {
                snapshot = { identity: null, software: [...registered.values()].filter(item => !item.infrastructure && !item.demo)
                    .map(item => ({ applicationId: item.id, name: item.name, mode: 'UNAVAILABLE', allowed: false,
                        reason: '请检查公共账户的服务地址和客户端配置后重试，软件资料与草稿保留。' })) };
                issue = { code: 'ACCOUNT_CONFIGURATION_REQUIRED', message: '账户连接尚未就绪，请检查公共账户连接配置后点击刷新；公共基建继续可用。' };
            }
            return { ...snapshot, issue, software: snapshot.software.map(item => {
                const permission = status(item.applicationId);
                return { ...item, allowed: permission.allowed, reasonCode: permission.reason,
                    reason: issue ? issue.message : item.reason };
            }) };
        },
        /** 每个业务动作重新核验；基建、登录、购买与草稿恢复不依赖软件订阅。 */
        async require(id) {
            updateApplications();
            if (infrastructure(id)) return;
            try { await access.require(id); }
            catch (error) {
                diagnostic('require', error);
                throw Object.assign(new Error('请在个人中心登录、核对订阅或重试连接。当前资料和草稿保留。'),
                    { code: classification(error), guidance: true });
            }
        },
        signIn: async signal => { updateApplications(); return (await session()).signIn(signal); },
        signOut: async () => (await session()).signOut(),
        openStore: async id => { updateApplications(); return (await session()).openStore(id); },
        openRegistration: async () => {
            const current = await session();
            if (!current.openRegistration) throw Object.assign(new Error('注册入口尚未配置，请使用已有账户登录或联系维护者'), { code: 'ACCOUNT_REGISTRATION_UNAVAILABLE' });
            return current.openRegistration();
        },
        /** 初始化只建立软件状态，连通失败留给个人中心引导。 */
        async initialize() { try { updateApplications(); await access.refresh(available()); } catch (error) { diagnostic('initialize', error); } finally { startMonitoring(); } },
        async destroy() {
            if (disposed) return;
            disposed = true; monitoring = false;
            if (recheckTimer) clearTimer(recheckTimer);
            recheckTimer = undefined;
            access.destroy(); workspace?.destroy(); authorization?.destroy(); portal?.destroy();
            if (providerTask) { const provider = await providerTask; await provider.destroy(); }
        },
    };
}
module.exports = { createDesktopAccount };
