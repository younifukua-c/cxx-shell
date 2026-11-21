'use strict';

const MAX_APPLICATIONS = 64;
const CONCURRENCY = 4;
const MAX_ACTIVE_PROJECTS = 4;
const TIMEOUT_MS = 30000;
const clone = value => structuredClone(value);
const failure = (code, message) => Object.assign(new Error(message), { code });

/** 项目已保存后通知应用；每个应用独立完成，不回滚项目或其他应用。 */
function createProjectInitialization({ load, save, listApplications, onChange = () => {}, timeoutMs = TIMEOUT_MS }) {
    const pending = new Map(), currentStates = new Map();
    let disposed = false;
    if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > TIMEOUT_MS) throw TypeError('初始化期限无效');
    const snapshot = project => {
        const value = currentStates.get(project.id) || load(project.id);
        const state = value?.path === project.path ? clone(value) : { projectId: project.id, path: project.path, applications: [] };
        if (!pending.has(project.id)) for (const entry of state.applications) if (['pending', 'running'].includes(entry.status)) {
            entry.status = 'failed'; entry.message = '上次初始化被中断，项目和其他应用已保留，请单独重试';
        }
        return state;
    };
    const notify = state => onChange(clone(state));
    async function initialize(project, { applicationId, configuration = {} } = {}) {
        if (disposed) throw failure('PROJECT_INITIALIZATION_CLOSED', '初始化服务已关闭，请重新打开应用');
        if (!project?.id || !project.path) throw TypeError('请先保存项目基础信息');
        const key = project.id;
        if (pending.has(key)) {
            if (pending.get(key).path !== project.path) throw failure('PROJECT_INITIALIZATION_BUSY', '项目位置已更新，请等待旧任务结束后重试新位置');
            if (pending.get(key).applicationId !== applicationId) throw failure('PROJECT_INITIALIZATION_BUSY', '此项目仍在准备其他应用，请完成后再重试所选应用');
            return pending.get(key).task;
        }
        if (pending.size >= MAX_ACTIVE_PROJECTS) throw failure('PROJECT_INITIALIZATION_BUSY', '已有项目正在准备，请稍候单独重试此项目');
        const controller = new AbortController();
        const task = run(project, applicationId, configuration, controller.signal);
        pending.set(key, { task, controller, applicationId, path: project.path });
        try { return await task; } finally { if (pending.get(key)?.task === task) { pending.delete(key); currentStates.delete(key); } }
    }
    async function run(project, applicationId, configuration, signal) {
        const available = await listApplications();
        if (!Array.isArray(available) || available.length > MAX_APPLICATIONS) throw failure('PROJECT_APPLICATION_LIMIT', '应用数量超出初始化上限，请在应用中心核对');
        const ids = new Set();
        const modules = available.filter(app => app.enabled).map(app => {
            if (!/^[a-zA-Z0-9][\w.-]{0,127}$/.test(app.id) || ids.has(app.id)) throw TypeError('应用标识重复或无效');
            ids.add(app.id); return app;
        }).filter(app => !applicationId || app.id === applicationId);
        if (applicationId && !modules.length) throw failure('PROJECT_APPLICATION_DISABLED', '请先在应用中心启用此应用，再重试初始化');
        const state = snapshot(project);
        currentStates.set(project.id, state);
        const entries = new Map(state.applications.map(entry => [entry.id, entry]));
        for (const app of modules) entries.set(app.id, { ...entries.get(app.id), id: app.id, name: app.name, status: 'pending', message: '等待初始化' });
        state.applications = [...entries.values()];
        await save(project.id, clone(state)); notify(state);
        let next = 0;
        async function worker() {
            while (!signal.aborted && next < modules.length) {
                const app = modules[next++], entry = entries.get(app.id);
                Object.assign(entry, { status: 'running', message: '正在初始化' }); notify(state);
                let timer;
                const operation = new AbortController();
                const abort = () => operation.abort(signal.reason);
                signal.addEventListener('abort', abort, { once: true });
                try {
                    if (typeof app.initialize !== 'function') {
                        Object.assign(entry, { status: 'not-supported', message: '此应用未声明项目初始化能力，可在应用内继续使用' });
                        continue;
                    }
                    const deadline = new Promise((_, reject) => {
                        const cancel = () => reject(operation.signal.reason || failure('PROJECT_INITIALIZATION_CANCELLED', '初始化已取消，可重新尝试'));
                        operation.signal.addEventListener('abort', cancel, { once: true });
                        timer = setTimeout(() => operation.abort(failure('PROJECT_INITIALIZATION_TIMEOUT', '初始化超时，请检查应用配置后重试')), timeoutMs);
                    });
                    const result = await Promise.race([Promise.resolve().then(() => app.initialize(clone(project), clone(configuration), operation.signal)), deadline]);
                    if (result?.status === 'not-supported') {
                        Object.assign(entry, { status: 'not-supported', message: String(result.message || '此应用未提供项目初始化接口') });
                    } else if (result?.status === 'needs-configuration') {
                        Object.assign(entry, { status: 'needs-configuration', message: String(result.message || '基础空间已就绪，请补充配置后继续'),
                            requirements: normalizeRequirements(result.requirements) });
                    } else if (result?.success === false) {
                        throw failure(result.code || 'PROJECT_APPLICATION_FAILED', result.error || '应用初始化失败，请核对配置后重试');
                    } else Object.assign(entry, { status: 'ready', message: String(result?.message || '已就绪') });
                } catch (error) {
                    Object.assign(entry, { status: 'failed', message: String(error.message || error), code: error.code || 'PROJECT_APPLICATION_FAILED' });
                } finally {
                    clearTimeout(timer); signal.removeEventListener('abort', abort); notify(state);
                }
            }
        }
        await Promise.all(Array.from({ length: Math.min(CONCURRENCY, modules.length) }, worker));
        if (!disposed) { await save(project.id, clone(state)); notify(state); }
        return clone(state);
    }
    return { initialize, snapshot,
        destroy() { if (disposed) return; disposed = true; for (const value of pending.values()) value.controller.abort(failure('PROJECT_INITIALIZATION_CLOSED', '应用关闭，重新打开后可重试')); },
    };
}

/** 只保存引导说明；用户填写的配置不复制进公共项目记录。 */
function normalizeRequirements(values = []) {
    if (!Array.isArray(values) || values.length > 16) throw TypeError('应用配置要求无效');
    return values.map(value => {
        if (!value || !/^[\w.-]{1,64}$/.test(value.key) || typeof value.label !== 'string') throw TypeError('应用配置字段无效');
        return { key: value.key, label: value.label.slice(0, 200), description: String(value.description || '').slice(0, 1000) };
    });
}
module.exports = { createProjectInitialization };
