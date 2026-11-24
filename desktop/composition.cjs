"use strict";
const path = require("node:path");
const {
  createElectronViewHost,
} = require("@cxx/host-runtime/electron-view-host");
const { createApplicationHost } = require("@cxx/host-runtime/application-host");
const { createCloseRequests } = require("@cxx/host-runtime/close-requests");
const {
  createExternalApplications,
} = require("@cxx/host-runtime/application-loader");
const C = require("@cxx/host-runtime/host-channels");
const { createCatalog, SHELL_ID } = require("./catalog.cjs");
const { registerController } = require("./controller.cjs");
const { windowBranding } = require("./window-branding.cjs");
/** 独立主框架组装原生窗口、账户和外部应用，不加载任何Git或SQL实现。 */
async function createDesktopComposition({
  electron,
  runtime,
  hidden = false,
  createAccount,
  report = console.error,
}) {
  const catalog = createCatalog(runtime.environment),
    registered = new Set([SHELL_ID]);
  let host,
    account,
    stopping = false;
  const closeRequests = createCloseRequests({
    send: (contents, value) => contents.send(C.APPLICATION_HOST_CLOSING, value),
  });
  const notify = () => {
    for (const contents of views.contents())
      if (!contents.isDestroyed())
        contents.send(C.APPLICATION_HOST_CHANGED, { kind: "applications" });
  };
  const views = createElectronViewHost({
    electron,
    windowOptions: (id) => ({
      ...windowBranding(id, catalog.list()),
      width: 1480,
      height: 980,
      minWidth: 800,
      minHeight: 560,
      frame: false,
      show: !hidden,
      autoHideMenuBar: true,
    }),
    beforeClose: (contents) => closeRequests.request(contents),
    onViewClosed: (view) => {
      const id = host?.applicationOf(view.webContents);
      host?.closed(view);
      if (id && id !== SHELL_ID) external.closed(id).then(notify).catch(report);
    },
    onWindowCreated: (window) => {
      const publish = () => {
        for (const contents of views.contents())
          if (views.windowOf(contents) === window)
            contents.send(C.WINDOW_MAXIMIZE_CHANGED, {
              maximized: window.isMaximized(),
            });
      };
      window.on("maximize", publish);
      window.on("unmaximize", publish);
    },
    onWindowsChanged: () => {
      if (host && !stopping && !views.windows().length) electron.app.quit();
    },
    report,
  });
  account = createAccount({
    electron,
    environment: runtime.environment,
    listApplications: catalog.list,
    windowOf: (contents) => views.activeWindowOf(contents),
    onChanged: (event) => {
      for (const contents of views.contents())
        if (!contents.isDestroyed())
          contents.send(C.APPLICATION_HOST_CHANGED, event);
    },
    report,
  });
  const external = createExternalApplications({
    runtime,
    electron,
    report,
    access: (id) => ({
      require: () => account.require(id),
      status: () => account.status(id),
    }),
    hostContext: () => ({
      applicationHost: host,
      windowOf: (contents) => views.windowOf(contents),
      account,
    }),
    installationRoot: () => catalog.installation().directory,
  });
  const foundation = {
    id: SHELL_ID,
    name: "应用中心",
    infrastructure: true,
    sandbox: true,
    partition: "persist:cxx-shell",
    preload: path.join(__dirname, "dist/preload.cjs"),
    load: (view) =>
      view.webContents.loadFile(path.join(__dirname, "dist/index.html")),
  };
  host = createApplicationHost({
    viewHost: views,
    applications: [foundation],
    canOpen: catalog.canOpen,
    beforeOpen: async (id) => {
      if (id !== SHELL_ID) await account.require(id);
    },
    onChanged: notify,
  });
  const ensureApplication = (id) => {
    if (registered.has(id)) return;
    const record = catalog.list().find((item) => item.id === id);
    if (!record) throw Error("应用尚未登记，请从应用中心加入");
    host.register(external.descriptor(id, record));
    registered.add(id);
  };
  const closeApplication = async (id) => {
    const contents = host.contents(id);
    if (contents) {
      if (!(await closeRequests.request(contents)))
        throw Object.assign(Error("软件还有未保存内容，请保存或取消后重试"), {
          code: "CLOSE_CANCELLED",
        });
      contents.close({ waitForBeforeUnload: false });
    }
    await external.closed(id);
  };
  const unregister = host.unregister.bind(host);
  host.unregister = (id) => {
    unregister(id);
    registered.delete(id);
  };
  const stopController = registerController({
    electron,
    host,
    views,
    catalog,
    account,
    closeRequests,
    ensureApplication,
    notify,
    closeApplication,
  });
  await account.initialize();
  return {
    host,
    views,
    catalog,
    account,
    ensureApplication,
    async open(id = SHELL_ID) {
      ensureApplication(id);
      return host.open(id);
    },
    async destroy() {
      if (stopping) return;
      stopping = true;
      stopController();
      await external.destroy();
      await account.destroy();
      closeRequests.destroy?.();
      host.destroy();
    },
  };
}
module.exports = { createDesktopComposition };
