"use strict";
const { app, BaseWindow, WebContentsView, session } = require("electron");
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");
const {
  createNativeAuthorization,
} = require("../../packages/host-runtime/lib/account/native-authorization.cjs");
const {
  createAccountWorkspace,
} = require("../../packages/host-runtime/lib/account/workspace.cjs");
const REDIRECT_TIMEOUT_MS = 10000;
const root = process.argv[2];
if (!root || !process.env.CXX_TEST_SESSION_ROOT)
  throw Error("独立测试目录缺失");
app.setPath("userData", path.join(root, "profile"));
globalThis.nativeRedirectResult = app.whenReady().then(async () => {
  const events = [];
  const server = http.createServer((_request, response) => {
    response.writeHead(302, {
      Location: "http://127.0.0.1:17451/callback?state=synthetic",
    });
    response.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = "http://127.0.0.1:" + server.address().port;
  const window = new BaseWindow({ show: false });
  const owner = new WebContentsView();
  window.contentView.addChildView(owner);
  const electron = { BaseWindow, WebContentsView, session };
  const workspace = createAccountWorkspace({
    electron,
    windowOf: () => window,
  });
  const auth = createNativeAuthorization({
    electron,
    partition: "isolated-redirect",
    createWindow: (options) => {
      const surface = workspace.createWindow(options);
      for (const event of [
        "will-navigate",
        "will-redirect",
        "did-redirect-navigation",
        "did-fail-load",
      ]) {
        surface.webContents.on(event, (_event, target) =>
          events.push({
            event,
            target:
              typeof target === "number" ? target : new URL(target).pathname,
          }),
        );
      }
      return surface;
    },
  });
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), REDIRECT_TIMEOUT_MS);
  let result;
  try {
    const callback = await workspace.open(
      owner.webContents,
      {
        id: "redirect",
        page: "logout",
        theme: "dark",
        bounds: { x: 0, y: 0, width: 500, height: 500 },
      },
      () =>
        auth.authorize({
          url: origin + "/logout",
          issuer: origin,
          redirectUri: "http://127.0.0.1:17451/callback",
          signal: controller.signal,
        }),
    );
    result = { events, callback };
  } catch (error) {
    result = { events, code: error.code || error.message };
  } finally {
    clearTimeout(deadline);
    auth.destroy();
    workspace.destroy();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  fs.writeFileSync(path.join(root, "result.json"), JSON.stringify(result));
  // 夹具由测试入口持有并关闭，避免导航回调里自行退出 Chromium。
  return result;
});
