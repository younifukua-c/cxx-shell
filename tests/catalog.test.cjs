"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { createCatalog } = require("../desktop/catalog.cjs");
const runtime = require("@cxx/host-runtime");
test("应用中心按公开声明登记，拒绝身份冲突，移出保留业务程序和资料", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "shell-catalog-"));
  try {
    const environment = runtime.resolveEnvironment({
      options: runtime.launchOptions(
        ["--test-root=" + path.join(root, "data")],
        {},
      ),
      locatorFile: "",
      defaultRoot: root,
      codeSource: root,
      userId: "fixture",
    });
    const app = path.join(root, "application");
    fs.mkdirSync(app);
    fs.writeFileSync(
      path.join(app, "entry.cjs"),
      'throw Error("不得在登记时加载业务")',
    );
    fs.writeFileSync(path.join(app, "preload.cjs"), "");
    fs.writeFileSync(
      path.join(app, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        version: "1.0.0",
        cxxApplication: {
          schemaVersion: 1,
          id: "fixture-app",
          entry: "entry.cjs",
          preload: "preload.cjs",
        },
      }),
    );
    const catalog = createCatalog(environment);
    return catalog
      .add(app)
      .then(async () => {
        assert.equal(catalog.list().length, 2);
        assert.equal(catalog.canOpen("fixture-app"), true);
        await assert.rejects(catalog.add(app), {
          code: "APPLICATION_ALREADY_ADDED",
        });
        catalog.setEnabled("fixture-app", false);
        assert.equal(catalog.canOpen("fixture-app"), false);
        catalog.remove("fixture-app");
        assert.equal(catalog.list().length, 1);
        assert.equal(fs.existsSync(path.join(app, "entry.cjs")), true);
      })
      .finally(() => fs.rmSync(root, { recursive: true, force: true }));
  } catch (error) {
    fs.rmSync(root, { recursive: true, force: true });
    throw error;
  }
});

test("保留原应用中心的停用开关、分组和安装位置", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "shell-legacy-"));
  try {
    const environment = runtime.resolveEnvironment({
      options: runtime.launchOptions(
        ["--test-root=" + path.join(root, "data")],
        {},
      ),
      locatorFile: "",
      defaultRoot: root,
      codeSource: root,
      userId: "fixture",
    });
    const store = runtime.createStorage(environment);
    const file = store.file(
      "settings",
      "common",
      "application-center",
      "applications.json",
    );
    const original = {
      schemaVersion: 1,
      applications: {
        "fixture-app": { installed: true, enabled: false, used: true },
      },
      groups: [{ id: "dev", name: "开发" }],
      installationRoot: path.join(root, "programs"),
    };
    require("@cxx/host-runtime/files").writeJson(file, original);
    const catalog = createCatalog(environment);
    assert.equal(catalog.installation().directory, original.installationRoot);
    catalog.saveTheme("light");
    const saved = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.deepEqual(saved.groups, original.groups);
    assert.deepEqual(saved.applications, original.applications);
    assert.equal(createCatalog(environment).theme(), "light");
    fs.writeFileSync(file, "{invalid");
    assert.throws(() => createCatalog(environment));
    assert.equal(fs.readFileSync(file, "utf8"), "{invalid");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("登记软件目录保留产品消费的安装与启用字段，未开启工厂也能列出切换菜单", async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "shell-directory-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const environment = runtime.resolveEnvironment({ options: runtime.launchOptions(["--test-root=" + root], {}),
    locatorFile: "", defaultRoot: root, codeSource: root, userId: "fixture" });
  const catalog = createCatalog(environment);
  for (const id of ["source-derived", "deploy-flow"]) {
    const directory = path.join(root, id); fs.mkdirSync(directory);
    fs.writeFileSync(path.join(directory, "entry.cjs"), 'throw Error("不得为了列菜单运行工厂")');
    fs.writeFileSync(path.join(directory, "preload.cjs"), "");
    fs.writeFileSync(path.join(directory, "package.json"), JSON.stringify({ name: id, version: "1.0.0",
      cxxApplication: { id, entry: "entry.cjs", preload: "preload.cjs" } }));
    await catalog.add(directory);
  }
  const menu = () => catalog.list().filter(item => !item.infrastructure && item.installed &&
    (item.configuredEnabled ?? item.enabled)).map(item => item.id);
  assert.deepEqual(menu(), ["deploy-flow", "source-derived"]);
  catalog.setEnabled("deploy-flow", false);
  assert.deepEqual(menu(), ["source-derived"]);
  const disabled = catalog.list().find(item => item.id === "deploy-flow");
  assert.equal(disabled.installed, true);
  assert.equal(disabled.configuredEnabled, false);
  catalog.setEnabled("deploy-flow", true);
  assert.deepEqual(menu(), ["deploy-flow", "source-derived"]);
});
