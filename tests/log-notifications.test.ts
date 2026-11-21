import test from "node:test";
import assert from "node:assert/strict";
test("旧日志设置补齐消息默认值，默认关闭类别不覆盖显式开关", async () => {
  const { logCatalog, logSettings } =
    await import("../packages/app-shell/src/logging/model");
  const catalog = logCatalog([
    {
      id: "app",
      name: "A",
      logTypes: [{ id: "query", label: "查询", defaultEnabled: false }],
    },
  ]);
  const initial = logSettings(catalog);
  assert.equal(initial.types.app.query, false);
  assert.equal(initial.notifications!.durations.error, 5000);
  assert.equal(
    logSettings(catalog, { types: { app: { query: true } } }).types.app.query,
    true,
  );
  assert.throws(() =>
    logSettings(catalog, { notifications: { durations: { error: -1 } } }),
  );
});
