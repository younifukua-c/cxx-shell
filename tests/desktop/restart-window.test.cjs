"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { _electron: electron, expect } = require("@playwright/test");
const { rememberApp, closeApp } = require("../helpers/electron-close.cjs");

test(
  "同环境重启与重复入口保持一个窗口，只有显式拆窗新增窗口",
  { timeout: 90000 },
  async () => {
    const data = fs.mkdtempSync(
      path.join(process.env.CXX_TEST_SESSION_ROOT, "restart-window-"),
    );
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.NODE_OPTIONS;
    for (let attempt = 0; attempt < 2; attempt++) {
      const app = rememberApp(
        await electron.launch({
          args: [
            path.resolve(__dirname, "../helpers/hosted-main.cjs"),
            data,
            ...(process.env.CXX_SHELL_APPLICATION_ROOT
              ? [process.env.CXX_SHELL_APPLICATION_ROOT]
              : []),
            "--disable-gpu",
          ],
          env,
          timeout: 25000,
        }),
      );
      try {
        await expect
          .poll(() => app.evaluate(() => !!globalThis.shellQA))
          .toBe(true);
        const result = await app.evaluate(async () => {
          const qa = globalThis.shellQA;
          qa.state.denied = false;
          await qa.open();
          const sessions = qa.composition.host.list();
          return {
            windows: qa.composition.views.windows().length,
            windowIds: [...new Set(sessions.map((item) => item.windowId))],
            applicationId: sessions.find(
              (item) => item.applicationId !== "cxx-shell",
            ).applicationId,
            applicationName: qa.composition.catalog
              .list()
              .find(
                (item) =>
                  item.id ===
                  sessions.find(
                    (session) => session.applicationId !== "cxx-shell",
                  ).applicationId,
              ).name,
          };
        });
        assert.equal(result.windows, 1, "应用中心已有窗口时启动产品必须复用");
        assert.equal(result.windowIds.length, 1);
        const repeated = await app.evaluate(async () => {
          const qa = globalThis.shellQA;
          await qa.composition.open();
          const defaultActive = qa.composition.host
            .list()
            .find((item) =>
              qa.composition.views.activeWindowOf(
                qa.composition.host.contents(item.applicationId),
              ),
            )?.applicationId;
          await qa.open();
          await qa.open();
          const active = qa.composition.views.windows().map((window) => ({
            title: window.getTitle(),
            visible: qa.composition.host
              .list()
              .find(
                (item) =>
                  qa.composition.views.activeWindowOf(
                    qa.composition.host.contents(item.applicationId),
                  )?.id === window.id,
              )?.applicationId,
          }));
          return {
            windows: qa.composition.views.windows().length,
            active,
            defaultActive,
          };
        });
        assert.equal(repeated.windows, 1);
        assert.equal(repeated.active[0].visible, result.applicationId);
        assert.equal(repeated.defaultActive, result.applicationId);
        assert.equal(repeated.active[0].title, result.applicationName);
        const split = await app.evaluate(async (_electron, id) => {
          await globalThis.shellQA.composition.host.split(id);
          return globalThis.shellQA.composition.views.windows().length;
        }, result.applicationId);
        assert.equal(split, 2, "显式拆窗保留新窗口能力");
      } finally {
        await closeApp(app, { force: true });
      }
    }
  },
);
