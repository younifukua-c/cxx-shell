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
