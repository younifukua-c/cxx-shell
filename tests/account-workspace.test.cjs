"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const {
  createAccountWorkspace,
} = require("../packages/host-runtime/lib/account/workspace.cjs");
const {
  createNativeAuthorization,
} = require("../packages/host-runtime/lib/account/native-authorization.cjs");

/** 独立模拟原生父窗口和远程视图，禁止测试意外弹出真实认证窗口。 */
function fixture(t) {
  const owner = Object.assign(new EventEmitter(), {
    isDestroyed: () => false,
    getZoomFactor: () => 1,
  });
  const children = new Set(),
    views = [],
    cookies = [];
  const window = Object.assign(new EventEmitter(), {
    isDestroyed: () => false,
    getContentBounds: () => ({ width: 1000, height: 700 }),
    contentView: {
      addChildView: (view) => children.add(view),
      removeChildView: (view) => children.delete(view),
    },
  });
  const session = {
    cookies: { set: async (value) => cookies.push(value) },
    setPermissionRequestHandler() {},
    setPermissionCheckHandler() {},
  };
  class WebContentsView {
    constructor(options) {
      this.options = options;
      views.push(this);
      const contents = new EventEmitter();
      this.webContents = contents;
      Object.assign(contents, {
        destroyed: false,
        isDestroyed: () => contents.destroyed,
        focus() {},
        loadURL: async (url) => {
          contents.url = url;
        },
        setWindowOpenHandler: (callback) => {
          contents.openHandler = callback;
        },
        close: () => {
          contents.destroyed = true;
          contents.emit("destroyed");
        },
      });
    }
    setBounds(bounds) {
      this.bounds = bounds;
    }
    setVisible(visible) {
      this.visible = visible;
    }
  }
  const electron = {
    WebContentsView,
    BrowserWindow: class {
      constructor() {
        throw Error("unexpected popup");
      }
    },
    session: { fromPartition: () => session },
  };
  const secondOwner = Object.assign(new EventEmitter(), {
    isDestroyed: () => false,
    getZoomFactor: () => 1,
  });
  const workspace = createAccountWorkspace({
    electron,
    windowOf: (sender) =>
      sender === owner || sender === secondOwner ? window : null,
  });
  const auth = createNativeAuthorization({
    electron,
    partition: "test",
    createWindow: workspace.createWindow,
  });
  const input = {
    id: "account-1",
    page: "store",
    theme: "dark",
    bounds: { x: 300, y: 50, width: 900, height: 900 },
  };
  const openSurface = async () => {
    const surface = workspace.createWindow({
      webPreferences: { session, preload: "forbidden" },
    });
    await surface.loadURL("https://identity.test/login");
    surface.show();
    return surface;
  };
  t.after(() => {
    workspace.destroy();
    auth.destroy();
  });
  return {
    workspace,
    auth,
    input,
    owner,
    secondOwner,
    window,
    children,
    views,
    cookies,
    openSurface,
  };
}

test("账户右侧面板只使用沙箱视图并裁切内容区，主题只发到当前域，关闭不损坏业务页面", async (t) => {
  const f = fixture(t);
  await f.workspace.open(f.owner, f.input, f.openSurface);
  const view = f.views[0];
  assert.equal(view.options.webPreferences.preload, undefined);
  assert.equal(view.options.webPreferences.sandbox, true);
  assert.equal(view.options.webPreferences.contextIsolation, true);
  assert.equal(view.options.webPreferences.nodeIntegration, false);
  assert.deepEqual(view.bounds, { x: 300, y: 50, width: 700, height: 650 });
  assert.equal(f.cookies.length, 2);
  assert.ok(
    f.cookies.every((cookie) => cookie.url === "https://identity.test"),
  );
  f.workspace.resize(f.owner, {
    id: f.input.id,
    bounds: { x: 320, y: 80, width: 500, height: 400 },
    theme: "light",
  });
  assert.deepEqual(view.bounds, { x: 320, y: 80, width: 500, height: 400 });
  f.workspace.resize(f.owner, {
    id: f.input.id,
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    theme: "light",
  });
  assert.equal(view.visible, false, "宿主隐藏页面时远程视图必须同时隐藏");
  f.workspace.resize(f.owner, {
    id: f.input.id,
    bounds: { x: 320, y: 80, width: 500, height: 400 },
    theme: "light",
  });
  assert.equal(view.visible, true, "恢复页面不能重新创建认证会话");
  f.workspace.close({}, f.input.id);
  assert.equal(f.children.size, 1);
  f.workspace.close(f.owner, "other");
  assert.equal(f.children.size, 1);
  f.workspace.close(f.owner, f.input.id);
  assert.equal(f.children.size, 0);
  assert.equal(f.owner.listenerCount("destroyed"), 0);
  assert.equal(f.window.listenerCount("resize"), 0);
});

test("另一软件不能夺取正在进行的登录，原软件关闭后才能继续", async (t) => {
  const f = fixture(t);
  const pending = f.workspace.open(
    f.owner,
    { ...f.input, page: "login" },
    (signal) =>
      f.auth.authorize({
        url: "https://identity.test/oauth2/authorize",
        issuer: "https://identity.test",
        redirectUri: "http://127.0.0.1:17451/callback",
        signal,
      }),
  );
  const cancelled = assert.rejects(pending, { code: "LOGIN_CANCELLED" });
  await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(
    f.workspace.open(
      f.secondOwner,
      { ...f.input, id: "second", page: "login" },
      f.openSurface,
    ),
    { code: "ACCOUNT_BUSY" },
  );
  assert.equal(f.views.length, 1);
  assert.equal(f.views[0].webContents.isDestroyed(), false);
  f.workspace.close(f.owner, f.input.id);
  await cancelled;
  await f.workspace.open(
    f.secondOwner,
    { ...f.input, id: "second" },
    f.openSurface,
  );
  assert.equal(f.children.size, 1);
});

test("账户右侧面板取消旧请求不会把迟到授权页画到新页面，切换应用立即释放远程页面", async (t) => {
  const f = fixture(t);
  let resume;
  const waiting = new Promise((resolve) => {
    resume = resolve;
  });
  const previous = f.workspace.open(
    f.owner,
    { ...f.input, page: "login" },
    async () => {
      await waiting;
      return f.openSurface();
    },
  );
  const rejected = assert.rejects(previous, { code: "LOGIN_CANCELLED" });
  await f.workspace.open(f.owner, { ...f.input, id: "next" }, f.openSurface);
  resume();
  await rejected;
  assert.equal(f.views.length, 1);
  assert.equal(f.children.size, 1);
  f.owner.emit("cxx-account-surface-detached");
  assert.equal(f.children.size, 0);
  assert.equal(f.views[0].webContents.destroyed, true);
});

test("账户右侧面板拒绝未知父页面、非有限尺寸和非白名单页面，调用前不产生视图", async (t) => {
  const f = fixture(t);
  await assert.rejects(f.workspace.open({}, f.input, f.openSurface), {
    code: "ACCOUNT_CLOSED",
  });
  for (const patch of [
    { page: "https://evil.test" },
    { theme: "script" },
    { bounds: { ...f.input.bounds, x: NaN } },
    { id: "../escape" },
  ]) {
    await assert.rejects(
      f.workspace.open(f.owner, { ...f.input, ...patch }, f.openSurface),
      { code: "ACCOUNT_REQUEST_INVALID" },
    );
  }
  assert.equal(f.views.length, 0);
});

test("账户右侧面板标准授权仍只接受精确主框架回调，结束无遗留窗口或权限桥", async (t) => {
  const f = fixture(t);
  const pending = f.workspace.open(
    f.owner,
    { ...f.input, page: "login" },
    (signal) =>
      f.auth.authorize({
        url: "https://identity.test/oauth2/authorize",
        issuer: "https://identity.test",
        redirectUri: "http://127.0.0.1:17451/callback",
        signal,
      }),
  );
  await new Promise((resolve) => setImmediate(resolve));
  const contents = f.views[0].webContents;
  assert.deepEqual(contents.openHandler({ url: "https://evil.test" }), {
    action: "deny",
  });
  let prevented = false;
  contents.emit(
    "will-redirect",
    {
      isMainFrame: true,
      preventDefault() {
        prevented = true;
      },
    },
    "https://evil.test",
  );
  assert.equal(prevented, true);
  assert.equal(f.children.size, 1);
  contents.emit(
    "will-redirect",
    { isMainFrame: true, preventDefault() {} },
    "http://127.0.0.1:17451/callback?code=test&state=test",
  );
  assert.equal(
    await pending,
    "http://127.0.0.1:17451/callback?code=test&state=test",
  );
  assert.equal(f.children.size, 0);
  assert.equal(f.owner.listenerCount("destroyed"), 0);
});
