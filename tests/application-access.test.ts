import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accountAccessIndex,
  applicationAccess,
} from "../packages/app-shell/src/application-access";
import type { AccountSoftware } from "../packages/app-shell/src/account";

const state = {
  configured: true,
  verified: true,
  unavailable: false,
  authenticated: true,
};
const software = (
  overrides: Partial<AccountSoftware> = {},
): AccountSoftware => ({
  applicationId: "paid",
  name: "软件",
  mode: "SUBSCRIPTION",
  allowed: true,
  reason: "",
  ...overrides,
});
const index = (...items: AccountSoftware[]) =>
  accountAccessIndex({ identity: null, software: items });

test("软件资格：当前裁决的原始到期分类不能覆盖成面向界面的英文错误码", () => {
  const records = accountAccessIndex({
    identity: null,
    software: [
      software({
        allowed: false,
        reason: "尚未订阅",
        reasonCode: "NO_SUBSCRIPTION",
      }),
    ],
    currentApplication: {
      applicationId: "paid",
      allowed: false,
      reason: "OUTSIDE_ACCESS_PERIOD",
    },
  });
  const result = applicationAccess(records, "paid", state);
  assert.equal(result.message, "当前不在订阅有效期内，请查看套餐或续费。");
  assert.equal(result.recovery, "store");
  const unknown = applicationAccess(
    index(software({ allowed: false, reason: "UNKNOWN_PROVIDER_REASON" })),
    "paid",
    state,
  );
  assert.doesNotMatch(unknown.message, /UNKNOWN_PROVIDER_REASON/);
});

test("软件资格：首帧、未知映射和读取失败不能默认放行付费软件", () => {
  assert.equal(
    applicationAccess(index(software()), "paid", { ...state, verified: false })
      .allowed,
    false,
  );
  assert.equal(
    applicationAccess(index(software()), "unknown-module", state).allowed,
    false,
  );
  assert.equal(
    applicationAccess(index(software()), "paid", {
      ...state,
      unavailable: true,
    }).allowed,
    false,
  );
});
test("软件资格：仅宿主明确的免费可用状态允许连接恢复期间继续使用", () => {
  assert.equal(
    applicationAccess(index(software({ mode: "FREE" })), "paid", {
      ...state,
      verified: false,
      unavailable: true,
    }).allowed,
    true,
  );
  assert.equal(
    applicationAccess(
      index(software({ mode: "FREE", allowed: false })),
      "paid",
      state,
    ).allowed,
    false,
  );
});
test("软件资格：本地显示时间不能推翻宿主明确的 allowed", () => {
  assert.equal(
    applicationAccess(
      index(software({ expiresAt: "1970-01-01T00:00:00Z" })),
      "paid",
      state,
    ).allowed,
    true,
  );
  assert.equal(
    applicationAccess(
      index(software({ allowed: false, expiresAt: "2999-01-01T00:00:00Z" })),
      "paid",
      state,
    ).allowed,
    false,
  );
});
test("软件资格：当前软件的宿主裁决覆盖列表旧值，保留同软件的免费分类", () => {
  const records = accountAccessIndex({
    identity: null,
    software: [software({ mode: "FREE" })],
    currentApplication: {
      applicationId: "paid",
      allowed: false,
      reason: "",
      reasonCode: "LOGIN_REQUIRED",
    },
  });
  assert.equal(applicationAccess(records, "paid", state).allowed, false);
  assert.equal(applicationAccess(records, "paid", state).recovery, "account");
});
for (const [reasonCode, recovery] of [
  ["LOGIN_REQUIRED", "account"],
  ["OUTSIDE_ACCESS_PERIOD", "store"],
  ["NO_SUBSCRIPTION", "store"],
  ["UNAVAILABLE", "retry"],
] as const)
  test(`软件资格：稳定分类 ${reasonCode} 选择恢复入口`, () => {
    const result = applicationAccess(
      index(software({ allowed: false, reasonCode })),
      "paid",
      state,
    );
    assert.equal(result.recovery, recovery);
    assert.ok(result.message);
  });
test("软件资格：显式声明的软件映射缺少账户端口时关闭，普通无账户壳保留原用法", () => {
  assert.equal(
    applicationAccess(index(), "paid", {
      ...state,
      configured: false,
      required: true,
    }).allowed,
    false,
  );
  assert.equal(
    applicationAccess(index(), "unmanaged", { ...state, configured: false })
      .allowed,
    true,
  );
});
test("软件资格：仅显式 null 公共页面不受账户在途和失联影响，未知 id 仍关闭", () => {
  assert.equal(
    applicationAccess(index(), null, {
      ...state,
      verified: false,
      unavailable: true,
    }).allowed,
    true,
  );
  assert.equal(
    applicationAccess(index(), "foundation-entry", {
      ...state,
      verified: false,
    }).allowed,
    false,
  );
});
