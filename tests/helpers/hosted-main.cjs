"use strict";
const electron = require("electron"),
  fs = require("node:fs"),
  path = require("node:path");
if (!process.env.CXX_TEST_SESSION_ROOT) throw Error("仅允许隔离验收入口");
const data = process.argv[2],
  applicationRoot =
    process.argv[3] && !process.argv[3].startsWith("--")
      ? process.argv[3]
      : undefined;
const runtime = require("@cxx/host-runtime"),
  environment = runtime.resolveEnvironment({
    options: runtime.launchOptions(["--test-root=" + data], {}),
    locatorFile: "",
    defaultRoot: data,
    codeSource: __dirname,
    userId: "fixture",
  });
electron.app.setPath("userData", path.join(data, "profile"));
electron.protocol.registerSchemesAsPrivileged([
  {
    scheme: "cxx-file-preview",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);
electron.app.on("web-contents-created", (_event, contents) =>
  contents.on("preload-error", (_event, file, error) => {
    fs.appendFileSync(
      path.join(process.env.CXX_TEST_ARTIFACTS_DIR, "preload-error.txt"),
      file + "\n" + error.stack + "\n",
    );
  }),
);
let composition,
  closing = false;
electron.app
  .whenReady()
  .then(async () => {
    let root = applicationRoot;
    if (!root) {
      root = path.join(data, "fixture");
      fs.mkdirSync(root, { recursive: true });
      fs.copyFileSync(
        path.resolve(__dirname, "../../desktop/dist/preload.cjs"),
        path.join(root, "preload.cjs"),
      );
      fs.writeFileSync(
        path.join(root, "package.json"),
        JSON.stringify({
          name: "fixture-app",
          version: "1.0.0",
          cxxApplication: {
            schemaVersion: 1,
            id: "fixture-app",
            entry: "application.cjs",
            preload: "preload.cjs",
          },
        }),
      );
      fs.writeFileSync(
        path.join(root, "application.cjs"),
        "const fs=require('node:fs'),path=require('node:path');let serial=0;exports.createApplication=async({root})=>{const count=++serial;return{load:async view=>{fs.appendFileSync(path.join(root,'events.log'),'load:'+count+'\\n');await view.webContents.loadURL('data:text/html,<h1>Fixture child</h1>');},dispose:async()=>fs.appendFileSync(path.join(root,'events.log'),'dispose:'+count+'\\n')}};",
      );
    }
    const {
      inspectApplication,
    } = require("@cxx/host-runtime/installation-discovery");
    const record = inspectApplication(root);
    const {
      createApplicationModules,
    } = require("@cxx/host-runtime/application-modules");
    createApplicationModules(environment).register(record);
    const state = { denied: !applicationRoot, calls: [], root, id: record.id };
    composition =
      await require("../../desktop/composition.cjs").createDesktopComposition({
        electron,
        runtime: { environment, sourceId: "fixture" },
        hidden: true,
        report: (error) => {
          state.error = error.message;
        },
        createAccount: () => ({
          initialize: async () => {},
          require: async (id) => {
            state.calls.push(id);
            if (state.denied)
              throw Object.assign(Error("fixture denied"), {
                code: "NO_SUBSCRIPTION",
                guidance: true,
              });
          },
          status: () => ({ allowed: !state.denied }),
          snapshot: async () => ({
            identity: { subject: "fixture", displayName: "合成账户" },
            software: [
              {
                applicationId: record.id,
                name: record.name,
                mode: "SUBSCRIPTION",
                allowed: !state.denied,
                reason: state.denied ? "测试拒绝" : "",
              },
            ],
          }),
          destroy: async () => {},
        }),
      });
    await composition.open();
    globalThis.shellQA = {
      composition,
      state,
      open: () => composition.open(record.id),
      close: async () => {
        const contents = composition.host.contents(record.id);
        contents?.close({ waitForBeforeUnload: false });
      },
    };
  })
  .catch((error) => {
    fs.writeFileSync(
      path.join(process.env.CXX_TEST_ARTIFACTS_DIR, "hosted-startup.txt"),
      error.stack || error.message,
    );
    console.error(error);
    electron.app.exit(1);
  });
electron.app.on("before-quit", (event) => {
  event.preventDefault();
  if (closing) return;
  closing = true;
  Promise.resolve(composition?.destroy()).finally(() => electron.app.exit(0));
});
