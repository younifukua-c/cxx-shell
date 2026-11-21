import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createRuntime,
  validateApplications,
  type ApplicationModule,
} from "../packages/app-shell/src/runtime";
const module = (id: string): ApplicationModule => ({
  id,
  name: id,
  page: {},
  createState: () => ({ selected: "initial" }),
});
test("应用、外壳实例状态互不覆盖，切回可恢复", () => {
  const a = createRuntime(module("a"), () => assert.fail());
  const b = createRuntime(module("b"), () => assert.fail());
  const another = createRuntime(module("a"), () => assert.fail());
  Object.assign(a.state, { selected: "A-project" });
  a.activate();
  a.deactivate();
  b.activate();
  Object.assign(b.state, { selected: "B-project" });
  b.deactivate();
  a.activate();
  assert.deepEqual(a.state, { selected: "A-project" });
  assert.deepEqual(b.state, { selected: "B-project" });
  assert.deepEqual(another.state, { selected: "initial" });
});
test("失效请求即使忽略 AbortSignal 也不提交，重新激活也不能复活旧响应", async () => {
  const session = createRuntime(module("a"), () => assert.fail());
  session.activate();
  let finish!: (value: string) => void;
  let signal!: AbortSignal;
  const first = session.runLatest(
    "read",
    (s) => {
      signal = s;
      return new Promise<string>((r) => (finish = r));
    },
    () => assert.fail("旧响应提交"),
  );
  session.deactivate();
  session.activate();
  assert.equal(signal.aborted, true);
  finish("old");
  assert.equal(await first, false);
  const committed: string[] = [];
  let slow!: (value: string) => void;
  const pending = session.runLatest(
    "read",
    () => new Promise<string>((r) => (slow = r)),
    (r) => committed.push(r),
  );
  assert.equal(
    await session.runLatest(
      "read",
      async () => "latest",
      (r) => committed.push(r),
    ),
    true,
  );
  slow("slow");
  await pending;
  assert.deepEqual(committed, ["latest"]);
});
test("失效错误静默取消，当前失败经统一错误通道报告", async () => {
  const errors: unknown[] = [];
  const session = createRuntime(module("a"), (e) => errors.push(e));
  session.activate();
  await session.runLatest(
    "read",
    async () => {
      throw new Error("真实失败");
    },
    () => assert.fail(),
  );
  assert.equal(errors.length, 1);
  let fail!: (reason: unknown) => void;
  const pending = session.runLatest(
    "read",
    () => new Promise((_, reject) => (fail = reject)),
    () => assert.fail(),
  );
  session.deactivate();
  fail(new Error("过期"));
  await pending;
  assert.equal(errors.length, 1);
});
test("拒绝空注册表和重复应用身份", () => {
  assert.throws(() => validateApplications([]));
  assert.throws(() => validateApplications([module("a"), module("a")]));
});
test("拒绝同一个应用分组声明不同名称或图标", () => {
  const menuGroup = { id: "deploy", label: "部署流", icon: "/deploy.svg" };
  const first = { ...module("servers"), menuGroup };
  const second = { ...module("relations"), menuGroup: { ...menuGroup } };
  assert.doesNotThrow(() => validateApplications([first, second]));
  for (const conflict of [{ label: "运维" }, { icon: "/operations.svg" }]) {
    const inconsistent = {
      ...second,
      menuGroup: { ...menuGroup, ...conflict },
    };
    assert.throws(() => validateApplications([first, inconsistent]), /deploy/);
  }
});
test("应用功能属于注册应用，会话隔离且拒绝未知入口", () => {
  const definition = {
    ...module("a"),
    accountFeatures: [{ id: "settings", label: "设置", component: {} }],
  };
  const a = createRuntime(definition, () => assert.fail()),
    b = createRuntime(module("b"), () => assert.fail());
  a.activate();
  a.openFeature("settings");
  assert.equal(a.feature, "settings");
  assert.equal(b.feature, null);
  assert.throws(() => a.openFeature("unknown"));
  a.deactivate();
  a.openFeature(null);
  assert.equal(a.feature, "settings");
  a.activate();
  a.openFeature(null);
  assert.equal(a.feature, null);
  assert.throws(() =>
    validateApplications([
      {
        ...definition,
        accountFeatures: [
          ...definition.accountFeatures,
          ...definition.accountFeatures,
        ],
      },
    ]),
  );
});
