"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const {
  createNativeAuthorization,
} = require("../packages/host-runtime/lib/account/native-authorization.cjs");

/** 只模拟本次窗口事件，测试不创建真实浏览器或使用系统会话。 */
function fixture() {
  const windows = [];
  class Window extends EventEmitter {
    constructor(options) {
      super();
      this.options = options;
      this.shown = false;
      this.destroyed = false;
      this.webContents = new EventEmitter();
      this.webContents.setWindowOpenHandler = () => {};
      windows.push(this);
    }
    loadURL() {
      return Promise.resolve();
    }
    show() {
      this.shown = true;
    }
    focus() {}
    isDestroyed() {
      return this.destroyed;
    }
    destroy() {
      this.destroyed = true;
    }
    close() {
      this.emit("closed");
    }
  }
  const auth = createNativeAuthorization({
    electron: {
      BrowserWindow: Window,
      session: {
        fromPartition: () => ({
          setPermissionRequestHandler() {},
          setPermissionCheckHandler() {},
        }),
      },
    },
    partition: "synthetic",
  });
  return {
    auth,
    windows,
    request: {
      url: "https://identity.test/oauth2/authorize",
      issuer: "https://identity.test",
      redirectUri: "http://127.0.0.1:17451/callback",
    },
  };
}

test("授权页加载完成后才显示；只接收主框架精确回调，关闭释放本次窗口", async () => {
  const f = fixture(),
    task = f.auth.authorize(f.request),
    window = f.windows[0];
  assert.equal(window.options.show, false);
  await Promise.resolve();
  assert.equal(window.shown, true);
  let prevented = 0;
  window.webContents.emit(
    "will-redirect",
    {
      isMainFrame: false,
      preventDefault() {
        prevented++;
      },
    },
    "http://127.0.0.1:17451/callback?state=child",
  );
  assert.equal(window.destroyed, false);
  window.webContents.emit(
    "will-redirect",
    {
      isMainFrame: true,
      preventDefault() {
        prevented++;
      },
    },
    "http://127.0.0.1:17451/callback?state=owned",
  );
  assert.equal(await task, "http://127.0.0.1:17451/callback?state=owned");
  assert.equal(prevented, 2);
  assert.equal(window.destroyed, true);
  f.auth.destroy();
});

test("客户端未登记时关闭HTTP错误页，提供接入配置引导而不展示原始错误", async () => {
  const f = fixture(),
    task = f.auth.authorize(f.request),
    window = f.windows[0];
  window.webContents.emit(
    "did-navigate",
    {},
    "https://identity.test/error",
    400,
  );
  await assert.rejects(task, { code: "ACCOUNT_CONFIGURATION_REQUIRED" });
  assert.equal(window.shown, false);
  assert.equal(window.destroyed, true);
  f.auth.destroy();
});

test("取消与宿主关闭不会遗留授权窗口，关闭后不能再次打开", async () => {
  const f = fixture(),
    pending = f.auth.authorize(f.request);
  f.auth.destroy();
  f.auth.destroy();
  await assert.rejects(pending, { code: "LOGIN_CANCELLED" });
  await assert.rejects(f.auth.authorize(f.request), {
    code: "LOGIN_CANCELLED",
  });
  assert.equal(f.windows.length, 1);
  assert.equal(f.windows[0].destroyed, true);
});
