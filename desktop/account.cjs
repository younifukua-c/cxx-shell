"use strict";
const { createDesktopAccount } = require("@cxx/host-runtime/account");
const { createStorage } = require("@cxx/host-runtime/storage");
const { readJson } = require("@cxx/host-runtime/files");
const {
  resolveAccountAuthority,
} = require("@cxx/host-runtime/account-authority");
/** 框架拥有账户与资格；产品只得到限定到自身的软件访问端口。 */
function createAccount({
  electron,
  environment,
  listApplications,
  windowOf,
  onChanged,
  report,
}) {
  const file = createStorage(environment).file(
    "settings",
    "common",
    "identity",
    "connection.json",
  );
  return createDesktopAccount({
    electron,
    environment,
    listApplications,
    windowOf,
    onChanged,
    configuration: () =>
      resolveAccountAuthority({
        profile: require("../package.json").cxxAuthority,
        packaged: electron.app.isPackaged,
        mode: environment.mode,
        root: environment.root,
        saved: readJson(file, {}),
      }),
    onDiagnostic: (event) =>
      report(
        Object.assign(Error("账户连接未完成，请检查连接后重试"), {
          code: event.code,
        }),
      ),
    createProvider: async (options) =>
      (await import("@cxx/scc-sdk/desktop")).createSccAccountProvider(options),
  });
}
module.exports = { createAccount };
