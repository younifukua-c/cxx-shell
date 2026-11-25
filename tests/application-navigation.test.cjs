const test = require("node:test"),
  assert = require("node:assert/strict");
const {
  applicationNavigation,
} = require("../packages/host-runtime/lib/application-navigation.cjs");
test("安装菜单只接受有限的本应用二级入口并必须包含首页", () => {
  assert.deepEqual(
    applicationNavigation(
      [
        { id: "source-derived", name: "源·派生" },
        { id: "process", name: "进程管理", icon: "monitor-activity" },
      ],
      "source-derived",
    ).map((item) => item.id),
    ["source-derived", "process"],
  );
  for (const value of [
    [],
    [{ id: "other", name: "其他" }],
    [
      { id: "source-derived", name: "首页" },
      { id: "source-derived", name: "重复" },
    ],
    [{ id: "__cxx_settings__", name: "保留入口" }],
  ])
    assert.throws(() => applicationNavigation(value, "source-derived"), {
      code: "APPLICATION_MENU_INVALID",
    });
});
