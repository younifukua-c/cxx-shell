'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createApplicationModules } = require('@cxx/host-runtime/application-modules');
const { createExternalApplications } = require('@cxx/host-runtime/application-loader');

/** 同一软件的释放闸门模拟需要独占的 JVM 或文件资源，不启动额外服务。 */
function fixture(t) {
    assert.ok(process.env.CXX_TEST_SESSION_ROOT, '必须使用独立测试入口');
    const session = fs.realpathSync(process.env.CXX_TEST_SESSION_ROOT);
    const root = fs.mkdtempSync(path.join(session, 'external-reopen-'));
    let release, disposing;
    const gate = new Promise(resolve => { release = resolve; });
    const disposeStarted = new Promise(resolve => { disposing = resolve; });
    const state = { created: 0, disposed: [], rejectDispose: false,
        async dispose(id) { if (id === 1) { disposing(); await gate; }
            if (state.rejectDispose) throw Object.assign(Error('资源释放尚未确认'), { code: 'ENVIRONMENT_LEASE_MISSING' });
            state.disposed.push(id); },
    };
    fs.writeFileSync(path.join(root, 'preload.cjs'), '');
    fs.writeFileSync(path.join(root, 'entry.cjs'),
        'exports.createApplication = async ({ electron }) => { const id = ++electron.created; return { load: async () => {}, dispose: () => electron.dispose(id) }; };');
    const environment = { id: 'reopen', owner: 'synthetic-account', mode: 'test', root: path.join(root, 'data') };
    createApplicationModules(environment).register({ id: 'example', name: 'Example', version: '1.0.0', root, entry: 'entry.cjs', preload: 'preload.cjs' });
    const external = createExternalApplications({ runtime: { environment }, electron: state });
    const tasks = [];
    const track = promise => { tasks.push(promise); promise.catch(() => {}); return promise; };
    t.after(async () => {
        state.rejectDispose = false; release();
        await Promise.allSettled(tasks); await external.waitClosed(); await external.destroy();
        assert.ok(fs.realpathSync(root).startsWith(session + path.sep));
        fs.rmSync(root, { recursive: true, force: true });
    });
    return { state, release, disposeStarted, external, track };
}

test('同一软件重开等待旧实例释放，不能丢失新实例的资源所有权', async t => {
    const f = fixture(t), view = { webContents: { isDestroyed: () => false } };
    await f.external.descriptor('example').load(view);
    const closing = f.track(f.external.closed('example'));
    await f.disposeStarted;
    const loading = f.track(f.external.descriptor('example').load(view));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.state.created, 1, '旧资源尚未释放，不能创建替代实例');
    f.release(); await closing; await loading;
    assert.equal(f.state.created, 2);
    await f.external.closed('example');
    assert.deepEqual(f.state.disposed, [1, 2], '新实例必须保留到所属释放流程');
});

test('重开等待期间窗口已销毁，不再创建软件资源', async t => {
    const f = fixture(t);
    await f.external.descriptor('example').load({ webContents: { isDestroyed: () => false } });
    const closing = f.track(f.external.closed('example'));
    await f.disposeStarted;
    let destroyed = false;
    const loading = f.track(f.external.descriptor('example').load({ webContents: { isDestroyed: () => destroyed } }));
    await new Promise(resolve => setImmediate(resolve)); destroyed = true; f.release();
    await closing;
    await assert.rejects(loading, { code: 'APPLICATION_CLOSED' });
    assert.equal(f.state.created, 1);
});

test('旧资源释放失败时重开失败关闭，恢复后先释放旧实例再重新创建', async t => {
    const f = fixture(t), view = { webContents: { isDestroyed: () => false } };
    await f.external.descriptor('example').load(view);
    f.state.rejectDispose = true;
    const closing = f.track(f.external.closed('example'));
    await f.disposeStarted;
    const loading = f.track(f.external.descriptor('example').load(view));
    f.release();
    await assert.rejects(closing, { code: 'ENVIRONMENT_LEASE_MISSING' });
    await assert.rejects(loading, { code: 'ENVIRONMENT_LEASE_MISSING' });
    assert.equal(f.state.created, 1);
    f.state.rejectDispose = false;
    await f.external.descriptor('example').load(view);
    assert.equal(f.state.created, 2);
    await f.external.closed('example');
    assert.deepEqual(f.state.disposed, [1, 2]);
});
