'use strict';
const { failure } = require('./files.cjs');
const { performance } = require('node:perf_hooks');
const { MAX_APPLICATIONS, readAccessDecisions } = require('./access-response.cjs');

/** 软件使用资格只由注入的服务端端口裁决，不改变安装、启用选择或公共基建。 */
function createApplicationAccess({ provider, onChanged = () => {}, now = () => performance.now(), setTimer = setTimeout, clearTimer = clearTimeout }) {
    if (!provider || typeof provider.check !== 'function') throw new TypeError('软件资格查询端口必填');
    const records = new Map();
    let generation = 0, pending, controller, timer, disposed = false;

    /** 撤下旧许可并通知所属软件；不删除数据或直接关闭窗口。 */
    function clear(reason) {
        const changed = [...records.keys()];
        records.clear();
        if (timer) clearTimer(timer);
        timer = undefined;
        if (changed.length || reason === 'ACCOUNT_CHANGED') onChanged(changed, reason);
    }

    /** 只认可未到服务端覆盖期限、且仍在短时复核窗口内的内存快照。 */
    function status(applicationId) {
        const record = records.get(applicationId);
        if (!record || record.deadline <= now()) return { allowed: false, reason: record ? 'EXPIRED' : 'NOT_VERIFIED' };
        return { allowed: record.allowed, reason: record.reason, validUntil: record.validUntil };
    }

    /** 成功与失败共用容量边界，淘汰最久未核对的展示记录；淘汰从不等于授权。 */
    function retain(updates) {
        for (const [id, record] of updates) { records.delete(id); records.set(id, record); }
        const evicted = [];
        while (records.size > MAX_APPLICATIONS) {
            const id = records.keys().next().value;
            records.delete(id); evicted.push(id);
        }
        return evicted;
    }

    /** 最早到期的一批软件失效后继续安排其他软件，不因单项复核清空无关许可。 */
    function schedule() {
        if (timer) clearTimer(timer);
        timer = undefined;
        if (!records.size) return;
        const deadlines = [...records.values()].map(item => item.deadline).filter(Number.isFinite);
        if (!deadlines.length) return;
        const earliest = Math.min(...deadlines);
        timer = setTimer(() => {
            timer = undefined;
            const expired = [...records].filter(([, item]) => item.deadline <= now()).map(([id]) => id);
            for (const id of expired) records.delete(id);
            schedule();
            if (expired.length) onChanged(expired, 'RECHECK_REQUIRED');
        }, Math.max(0, earliest - now()));
        timer?.unref?.();
    }

    /** 单批共享一次远端查询；未知、重复、缺项或迟到响应均不能发布许可。 */
    async function refresh(applications, revision = generation) {
        if (disposed) throw failure('ACCESS_CLOSED', '软件资格会话已关闭');
        if (revision !== generation) throw failure('ACCESS_CHANGED', '账户已变化，请重新核对软件资格');
        if (!Array.isArray(applications) || applications.length > MAX_APPLICATIONS) throw failure('ACCESS_LIMIT', '软件资格查询超过上限');
        const requested = new Set(applications), ids = [...requested];
        if (ids.some(id => typeof id !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(id))) throw failure('ACCESS_INPUT_INVALID', '软件标识无效');
        if (!ids.length) return;
        const key = ids.slice().sort().join(',');
        if (pending) {
            if (pending.revision === revision && pending.key === key) return pending.task;
            await pending.task.catch(() => {});
            return refresh(ids, revision);
        }
        const started = now(), request = new AbortController();
        controller = request;
        const task = Promise.resolve().then(async () => {
            try {
                const response = await provider.check(ids, request.signal);
                if (disposed || generation !== revision) throw failure('ACCESS_CHANGED', '账户已变化，请重新核对软件资格');
                const accepted = readAccessDecisions(response, requested, started);
                const changed = [...accepted].filter(([id, value]) => {
                    const previous = records.get(id);
                    // 开发许可每次复核都会滑动续期；只更新内部截止时间，避免通知触发读取再续期的循环。
                    const slidingDevelopment = value.allowed && value.reason === 'ADMINISTRATOR_DEVELOPMENT';
                    return !previous || previous.allowed !== value.allowed || previous.reason !== value.reason
                        || (!slidingDevelopment && previous.validUntil !== value.validUntil);
                }).map(([id]) => id);
                const evicted = retain(accepted);
                schedule();
                if (changed.length || evicted.length) onChanged([...new Set([...changed, ...evicted])], 'VERIFIED');
            } catch (error) {
                if (!disposed && generation === revision) {
                    // 首次失败由本次读取返回，撤下既有状态时才通知订阅者。
                    const changed = ids.filter(id => records.has(id) && records.get(id).reason !== 'UNAVAILABLE');
                    const evicted = retain(ids.map(id => [id, { allowed: false, reason: 'UNAVAILABLE', validUntil: null, deadline: Infinity }]));
                    schedule();
                    if (changed.length || evicted.length) onChanged([...new Set([...changed, ...evicted])], 'UNAVAILABLE');
                }
                throw error;
            } finally {
                if (pending?.task === task) { pending = undefined; controller = undefined; }
            }
        });
        pending = { key, revision, task };
        return task;
    }

    /** 旧提供者即使忽略取消，也不能占住新账户的核验槽。 */
    function cancelRequests() {
        generation++;
        controller?.abort();
        controller = undefined; pending = undefined;
    }

    return {
        status, refresh,
        /** 受控软件动作前必须实时核验；不把内存展示快照当作新的操作许可。 */
        async require(applicationId) {
            const revision = generation;
            await refresh([applicationId], revision);
            if (disposed || revision !== generation) throw failure('ACCESS_CHANGED', '账户已变化，请重新执行此操作');
            const current = status(applicationId);
            if (!current.allowed) throw failure('APPLICATION_NOT_ENTITLED', '此软件当前不可用，请在个人中心核对订阅；公共基建和其他软件仍可使用');
        },
        /** 退出或切换账户立即使在途响应失效。 */
        reset() { cancelRequests(); clear('ACCOUNT_CHANGED'); },
        /** 只释放本实例资源，重复关闭安全。 */
        destroy() { if (disposed) return; disposed = true; cancelRequests(); clear('CLOSED'); },
    };
}
module.exports = { createApplicationAccess };
