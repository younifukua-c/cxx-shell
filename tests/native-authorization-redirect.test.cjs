"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { _electron: electron } = require("@playwright/test");
const { rememberApp, closeApp } = require("./helpers/electron-close.cjs");

test(
  "实际沙箱视图初始请求直接重定向时，无须访问回调监听端口",
  { timeout: 40000 },
  async () => {
    const root = fs.mkdtempSync(
      path.join(process.env.CXX_TEST_SESSION_ROOT, "native-redirect-"),
    );
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.NODE_OPTIONS;
    const application = rememberApp(
      await electron.launch({
        args: [
          path.resolve(__dirname, "helpers/native-redirect-app.cjs"),
          root,
          "--disable-gpu",
        ],
        env,
        timeout: 15000,
      }),
    );
    try {
      const result = await application.evaluate(
        () => globalThis.nativeRedirectResult,
      );
      assert.equal(result.code, undefined, JSON.stringify(result));
      assert.equal(
        result.callback,
        "http://127.0.0.1:17451/callback?state=synthetic",
      );
      assert.ok(result.events.some((event) => event.event === "will-redirect"));
    } finally {
      await closeApp(application, { force: true });
    }
  },
);
