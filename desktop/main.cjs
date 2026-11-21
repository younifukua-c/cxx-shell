"use strict";
const electron = require("electron"),
  path = require("node:path");
const { app, Menu, dialog } = electron;
const { prepareRuntime } = require("./runtime.cjs");
const { createHostLauncher } = require("@cxx/host-runtime/application-modules");
const { createAccount } = require("./account.cjs");
const manifest = require("../package.json");
app.setName(manifest.name);
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
let runtime,
  composition,
  kernel,
  closing = false;
const hidden = process.env.PLAYWRIGHT_TEST === "1";
try {
  runtime = prepareRuntime(app);
} catch (error) {
  process.stderr.write(error.message + "\n");
  app.exit(1);
  return;
}
const requested = process.argv
  .find((value) => value.startsWith("--application="))
  ?.slice("--application=".length);
const ready = app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  kernel = await require("@cxx/host-runtime/kernel").acquireKernel(
    runtime.environment,
    {
      sourceId: runtime.sourceId,
      applicationId: requested,
      open: async (id) => {
        await ready;
        await composition.open(id || "cxx-shell");
      },
    },
  );
  if (!kernel.primary) {
    app.exit(0);
    return;
  }
  require("./legacy-applications.cjs").registerPreviousApplication(
    runtime.environment,
  );
  composition = await require("./composition.cjs").createDesktopComposition({
    electron,
    runtime,
    hidden,
    createAccount,
  });
  createHostLauncher(runtime.environment).register({
    executable: process.execPath,
    args: app.isPackaged ? [] : [path.dirname(__dirname)],
    directory: app.isPackaged
      ? path.dirname(process.execPath)
      : path.dirname(__dirname),
    sourceId: runtime.sourceId,
  });
  await composition.open(requested || "cxx-shell");
});
ready.catch((error) => {
  console.error(error);
  if (!hidden) dialog.showErrorBox("框架启动未完成", error.message);
  app.exit(1);
});
app.on("before-quit", (event) => {
  event.preventDefault();
  if (closing) return;
  closing = true;
  const deadline = setTimeout(() => app.exit(1), 15000);
  Promise.resolve()
    .then(() => composition?.destroy())
    .then(() => kernel?.close())
    .catch(console.error)
    .finally(() => {
      clearTimeout(deadline);
      app.exit(0);
    });
});
