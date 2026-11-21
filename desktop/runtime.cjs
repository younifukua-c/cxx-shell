"use strict";
const fs = require("node:fs"),
  path = require("node:path");
const {
  launchOptions,
  resolveEnvironment,
} = require("@cxx/host-runtime/environment");
const { createStorage } = require("@cxx/host-runtime/storage");
const { systemIdentity } = require("@cxx/host-runtime/system-identity");
/** 数据身份按显式环境定位，不按安装目录或业务应用推断。 */
function prepareRuntime(app, args = process.argv.slice(1)) {
  const options = launchOptions(args, process.env),
    account = path.join(app.getPath("appData"), "CXX");
  if (app.isPackaged)
    require("@cxx/host-runtime/account-authority").validateAuthorityLaunch({
      profile: require("../package.json").cxxAuthority,
      packaged: true,
      mode: options.mode,
      root: options.root,
    });
  const environment = resolveEnvironment({
    options,
    locatorFile: path.join(account, "bootstrap.json"),
    defaultRoot: path.join(account, "environments", "production"),
    codeSource: path.dirname(__dirname),
    userId: systemIdentity(),
  });
  environment.instanceLock ||=
    environment.mode === "production"
      ? path.join(account, "locks", environment.id)
      : path.join(environment.root, "runtime", "instance-lock");
  const profile =
    environment.browserProfile ||
    environment.legacy?.userData ||
    createStorage(environment).directory("data", "common", "browser-profile");
  fs.mkdirSync(profile, { recursive: true });
  app.setPath("userData", profile);
  app.setPath("sessionData", profile);
  return {
    environment,
    sourceId: "cxx-shell:" + require("../package.json").version,
  };
}
module.exports = { prepareRuntime };
