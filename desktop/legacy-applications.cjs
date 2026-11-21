"use strict";
const fs = require("node:fs");
const path = require("node:path");
const {
  createHostLauncher,
  createApplicationModules,
} = require("@cxx/host-runtime/application-modules");
const {
  inspectApplication,
} = require("@cxx/host-runtime/installation-discovery");
/** 原宿主若已升级成公开应用，仅登记其原位置；不加载工厂、不改原设置。 */
function registerPreviousApplication(environment, report = console.error) {
  const previous = createHostLauncher(environment).read();
  if (!previous || previous.sourceId?.startsWith("cxx-shell:")) return;
  const root =
    previous.args?.find((value) =>
      fs.existsSync(path.join(value, "package.json")),
    ) || previous.directory;
  if (!fs.existsSync(path.join(root, "package.json"))) return;
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8"),
  );
  if (!manifest.cxxApplication) {
    report(
      Error(
        "原软件尚无公开应用入口，请升级后在应用中心重新加入；原资料已保留。",
      ),
    );
    return;
  }
  const modules = createApplicationModules(environment);
  const record = inspectApplication(root);
  if (!modules.list().some((item) => item.id === record.id))
    modules.register(record);
}
module.exports = { registerPreviousApplication };
