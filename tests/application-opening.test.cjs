"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict");
const { createApplicationHost } = require("@cxx/host-runtime/application-host");
const {
  createApplicationOpening,
} = require("../desktop/application-opening.cjs");
function fixture({ load = async () => {} } = {}) {
  const windows = new Map();
  let sequence = 0,
    denied;
  const views = {
    createWindow() {
      const id = ++sequence;
      windows.set(id, { id, isFocused: () => false, active: null });
      return id;
    },
    windows: () => [...windows.values()],
    createView: (entry) => ({
      webContents: {
        id: entry.id,
        isDestroyed: () => false,
        send() {},
        close() {},
      },
    }),
    attach: async () => {},
    confirm: async () => {},
    closeEmpty: async () => {},
    focus: async (session, id) => {
      windows.get(id).active = session.applicationId;
    },
    activeWindowOf: (contents) =>
      [...windows.values()].find((window) => window.active === contents.id),
    destroy: () => windows.clear(),
  };
  const host = createApplicationHost({
    viewHost: views,
    beforeOpen: async (id) => {
      if (id === denied) throw Error("不可用");
    },
    applications: ["cxx-shell", "source-derived", "deploy-flow"].map((id) => ({
      id,
      name: id,
      load: () => load(id),
    })),
  });
  const open = createApplicationOpening({
    host,
    views,
    ensureApplication() {},
    fallbackId: "cxx-shell",
  });
  return {
    host,
    views,
    open,
    deny: (id) => {
      denied = id;
    },
  };
}
test("启动器先打开中心再激活软件复用窗口，空激活保留当前软件", async (t) => {
  const f = fixture();
  t.after(() => f.host.destroy());
  await f.open();
  await f.open("source-derived");
  await f.open("deploy-flow");
  await f.open();
  assert.equal(f.views.windows().length, 1);
  assert.equal(f.views.windows()[0].active, "deploy-flow");
  assert.equal(new Set(f.host.list().map((item) => item.windowId)).size, 1);
});
test("冷启动并发请求共用第一个窗口，失败不替换当前软件", async (t) => {
  const f = fixture();
  t.after(() => f.host.destroy());
  await Promise.all([f.open("source-derived"), f.open("deploy-flow")]);
  assert.equal(f.views.windows().length, 1);
  assert.equal(f.views.windows()[0].active, "deploy-flow");
  f.deny("cxx-shell");
  await assert.rejects(f.open("cxx-shell"), /不可用/);
  assert.equal(f.views.windows().length, 1);
  assert.equal(f.views.windows()[0].active, "deploy-flow");
});
test("显式拆窗后再次激活原软件不合并、不新增第三个窗口", async (t) => {
  const f = fixture();
  t.after(() => f.host.destroy());
  await f.open();
  await f.open("source-derived");
  const split = await f.host.split("source-derived");
  assert.equal(f.views.windows().length, 2);
  await f.open("source-derived");
  assert.equal(f.views.windows().length, 2);
  assert.equal(
    f.host.list().find((item) => item.applicationId === "source-derived")
      .windowId,
    split.windowId,
  );
});

test("打开入口销毁后拒绝排队请求，不创建新窗口", async (t) => {
  const f = fixture();
  t.after(() => f.host.destroy());
  f.open.dispose();
  await assert.rejects(f.open("source-derived"), { code: "HOST_CLOSED" });
  assert.equal(f.views.windows().length, 0);
});

test("首个窗口已建立但尚未加载时，后续启动请求仍按顺序复用", async (t) => {
  let release, entered;
  const started = new Promise((resolve) => {
    entered = resolve;
  });
  const blocked = new Promise((resolve) => {
    release = resolve;
  });
  const f = fixture({
    load: async (id) => {
      if (id === "source-derived") {
        entered();
        await blocked;
      }
    },
  });
  t.after(() => f.host.destroy());
  const first = f.open("source-derived");
  await started;
  const latest = f.open("deploy-flow");
  release();
  await Promise.all([first, latest]);
  assert.equal(f.views.windows().length, 1);
  assert.equal(f.views.windows()[0].active, "deploy-flow");
});

function navigationFixture() {
  const pending = [], notifications = [];
  const host = { list: () => [], open: () => new Promise((resolve, reject) => pending.push({resolve, reject})),
    focus: async () => {}, contents: () => ({isDestroyed: () => false, send: (_channel, value) => notifications.push(value)}) };
  const open = createApplicationOpening({host, views: {windows: () => [{id: 1, isFocused: () => true}]},
    ensureApplication() {}, fallbackId: 'cxx-shell'});
  return {open, pending, notifications};
}
for (const scenario of [
  {name: '先失败旧请求再失败新请求', order: [0,1], success: [], expected: undefined},
  {name: '先失败新请求再失败旧请求', order: [1,0], success: [], expected: undefined},
  {name: '旧请求成功新请求失败', order: [0,1], success: [0], expected: 'servers'},
  {name: '新请求失败旧请求随后成功', order: [1,0], success: [0], expected: 'servers'},
  {name: '旧请求失败新请求成功', order: [0,1], success: [1], expected: 'clients'},
  {name: '新请求成功旧请求迟到成功', order: [1,0], success: [0,1], expected: 'clients'},
]) test('导航并发回滚：' + scenario.name, async () => {
  const f = navigationFixture();
  const a = f.open('deploy-flow', {entryId:'servers'}).then(() => true, () => false);
  const b = f.open('deploy-flow', {entryId:'clients'}).then(() => true, () => false);
  assert.equal(f.open.navigationOf('deploy-flow').entryId, 'clients', '首次加载可读取最新待打开入口');
  for (const index of scenario.order) {
    if (scenario.success.includes(index)) f.pending[index].resolve({applicationId:'deploy-flow'});
    else f.pending[index].reject(Error('打开失败'));
    await (index === 0 ? a : b);
  }
  assert.equal(f.open.navigationOf('deploy-flow')?.entryId, scenario.expected);
  const next = f.open('deploy-flow');
  f.pending[2].resolve({applicationId:'deploy-flow'}); await next;
  assert.equal(f.notifications.at(-1)?.entryId, scenario.expected, '再次激活只恢复成功入口');
  f.open.dispose();
});
test('导航入口销毁后迟到成功不能恢复导航或发送激活', async () => {
  const f = navigationFixture();
  const task = f.open('deploy-flow', {entryId:'servers'});
  f.open.dispose(); f.pending[0].resolve({applicationId:'deploy-flow'}); await task;
  assert.equal(f.open.navigationOf('deploy-flow'), undefined);
  assert.deepEqual(f.notifications, []);
});
