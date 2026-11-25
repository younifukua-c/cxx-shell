import test from "node:test";
import assert from "node:assert/strict";
import { projectApplicationMenu } from "../packages/app-shell/src/application-menu";
import {
  groupSwitcherOptions,
  shellUtilityOptions,
} from "../packages/app-shell/src/components/application-framework/shell/app/internal/application-switcher";
const catalog = [
  {
    id: "source-derived",
    name: "源·派生",
    navigation: [
      { id: "source-derived", name: "源·派生" },
      { id: "cxx-process-manager", name: "进程管理" },
    ],
  },
  {
    id: "deploy-flow",
    name: "部署流",
    navigation: [
      { id: "deploy-flow", name: "部署流" },
      { id: "servers", name: "服务器" },
    ],
  },
];
test("每个安装应用只追加一个一级菜单，各应用完整功能均在二级，切换当前应用不重排", () => {
  const source = groupSwitcherOptions(
    projectApplicationMenu(catalog, "source-derived").options,
  );
  const deploy = groupSwitcherOptions(
    projectApplicationMenu(catalog, "deploy-flow").options,
  );
  assert.deepEqual(
    source.map((item) => item.label),
    ["源·派生", "部署流"],
  );
  assert.deepEqual(
    source.map((item) => item.children?.map((child) => child.label)),
    [
      ["源·派生", "进程管理"],
      ["部署流", "服务器"],
    ],
  );
  const installed=groupSwitcherOptions(projectApplicationMenu([...catalog,{id:'notes',name:'速记'}],'source-derived').options);
  assert.deepEqual(installed.map(item=>item.label),['源·派生','部署流','速记']);
  assert.deepEqual(
    deploy.map((item) => [
      item.label,
      item.children?.map((child) => child.label),
    ]),
    source.map((item) => [
      item.label,
      item.children?.map((child) => child.label),
    ]),
  );
  const third = groupSwitcherOptions(
    projectApplicationMenu(
      [...catalog, { id: "extra", name: "新应用" }],
      "deploy-flow",
    ).options,
  );
  assert.deepEqual(
    third.map((item) => item.label),
    ["源·派生", "部署流", "新应用"],
  );
  assert.equal(third[2]?.children?.length, 1);
  const route = projectApplicationMenu(catalog, "source-derived").routes.get(
    "__cxx_link__:deploy-flow:servers",
  );
  assert.deepEqual(route, { applicationId: "deploy-flow", entryId: "servers" });
});
test("公共消息和设置一级入口不随应用是否提供任务车改变，非法菜单拒绝整批发布", () => {
  assert.deepEqual(
    shellUtilityOptions("log", "settings", undefined, true).map(
      (item) => item.label,
    ),
    ["应用消息", "应用设置"],
  );
  assert.deepEqual(
    shellUtilityOptions("log", "settings", { failures: 1 }, true).map(
      (item) => item.label,
    ),
    ["应用消息", "应用设置"],
  );
  assert.throws(() =>
    projectApplicationMenu(
      [
        {
          id: "extra",
          name: "应用",
          navigation: [
            { id: "x", name: "X" },
            { id: "x", name: "重复" },
          ],
        },
      ],
      "extra",
    ),
  );
});
