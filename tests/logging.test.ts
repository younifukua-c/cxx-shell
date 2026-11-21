import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createLogStore,
  createLogClient,
  trackLogOperation,
  type LogSnapshot,
} from "../packages/app-shell/src/logging";
const applications = [
  {
    id: "a",
    name: "应用 A",
    logTypes: [
      {
        id: "merge",
        label: "合并",
        group: "Git 与文件",
        description: "合并分支",
      },
    ],
  },
  { id: "b", name: "应用 B" },
];
function fixture() {
  let snapshot: LogSnapshot | undefined,
    time = Date.UTC(2026, 8, 25),
    writes = 0;
  const store = createLogStore({
    applications,
    now: () => time,
    id: () => String(writes),
    storage: {
      read: () => structuredClone(snapshot),
      write: (value) => {
        snapshot = structuredClone(value);
        writes++;
      },
    },
  });
  return {
    store,
    advance: (days: number) => {
      time += days * 86400000;
    },
    snapshot: () => snapshot,
    writes: () => writes,
  };
}
test("默认日志、应用类别隔离、开关只影响未来记录和过滤分页", () => {
  const { store } = fixture();
  assert.equal(
    store.catalog()[0]!.logTypes!.find((type) => type.id === "merge")!.group,
    "Git 与文件",
  );
  assert.equal(
    store.catalog()[0]!.logTypes!.find((type) => type.id === "merge")!
      .description,
    "合并分支",
  );
  assert.equal(store.getSettings().retentionDays, 30);
  store.record({
    appId: "a",
    type: "merge",
    message: "合并成功",
    scope: "workspace",
  });
  store.record({ appId: "b", type: "operation", message: "提交表单" });
  const settings = store.getSettings();
  settings.types.a!.merge = false;
  store.saveSettings(settings);
  assert.deepEqual(
    store.record({ appId: "a", type: "merge", message: "不再记录" }),
    {
      recorded: false,
    },
  );
  assert.equal(
    store.list({
      appId: "a",
      type: "merge",
      scopes: ["workspace"],
      search: "成功",
    }).total,
    1,
  );
  assert.equal(store.list({ limit: 1, offset: 1 }).items.length, 1);
  assert.equal(store.list({ appId: "b" }).items[0]!.message, "提交表单");
  assert.throws(() =>
    store.record({ appId: "b", type: "merge", message: "无效类别" }),
  );
  assert.throws(() => store.list({ limit: 201 }));
  assert.throws(() => store.saveSettings({ ...settings, retentionDays: 0 }));
});
test("保留时长按读写清理，更新设置一次写盘，持久化重建保持一致", () => {
  const f = fixture();
  f.store.record({ appId: "a", type: "merge", message: "旧日志" });
  f.advance(2);
  const before = f.writes();
  f.store.saveSettings({ ...f.store.getSettings(), retentionDays: 1 });
  assert.equal(f.writes(), before + 1);
  assert.equal(f.snapshot()!.entries.length, 0);
  f.store.record({
    appId: "b",
    type: "error",
    level: "error",
    message: "失败",
  });
  f.advance(2);
  assert.equal(f.store.list().total, 0);
  assert.equal(f.snapshot()!.entries.length, 0);
});
test("存储损坏、磁盘失败不覆盖旧数据；常见凭据脱敏", () => {
  const bad = createLogStore({
    applications,
    storage: {
      read: () => ({ version: 9 }),
      write: () => assert.fail("覆盖坏文件"),
    },
  });
  assert.throws(() =>
    bad.record({ appId: "a", type: "operation", message: "操作" }),
  );
  const denied = createLogStore({
    applications,
    storage: {
      read: () => undefined,
      write: () => {
        throw new Error("磁盘只读");
      },
    },
  });
  assert.throws(
    () => denied.record({ appId: "a", type: "operation", message: "操作" }),
    /磁盘只读/,
  );
  const { store } = fixture();
  store.record({
    appId: "a",
    type: "error",
    message: "token=abc password=123",
    details: "https://name:pass@server/path Bearer secret-token",
  });
  const entry = store.list().items[0]!;
  assert.doesNotMatch(
    entry.message + entry.details,
    /abc|123|name:pass|secret-token/,
  );
});
test("操作包装器同时记录失败 DTO、抛错和成功，不因日志失败重复业务", async () => {
  const { store } = fixture(),
    client = createLogClient(store);
  const entry = { appId: "a", type: "merge", message: "合并分支" };
  await trackLogOperation({
    client,
    entry,
    run: async () => ({ success: false }),
    outcome: (result) => result,
    onLogError: () => assert.fail(),
  });
  assert.equal(store.list({ level: "error" }).total, 1);
  const original = new Error("合并冲突");
  await assert.rejects(
    trackLogOperation({
      client,
      entry,
      run: async () => {
        throw original;
      },
      onLogError: () => assert.fail(),
    }),
    (error) => error === original,
  );
  let calls = 0,
    errors = 0;
  const result = await trackLogOperation({
    client: {
      record: async () => {
        throw new Error("磁盘失败");
      },
    },
    entry,
    run: async () => {
      calls++;
      return "已提交";
    },
    onLogError: () => {
      errors++;
    },
  });
  assert.equal(result, "已提交");
  assert.equal(calls, 1);
  assert.equal(errors, 1);
});
