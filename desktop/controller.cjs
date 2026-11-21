"use strict";
const C = require("@cxx/host-runtime/host-channels");
const { failure } = require("@cxx/host-runtime/files");
/** 只接受本宿主主框架与已登记视图的白名单请求。 */
function registerController({
  electron,
  host,
  views,
  catalog,
  account,
  closeRequests,
  ensureApplication,
  notify,
  closeApplication,
}) {
  const handlers = [],
    signIns = new Map();
  const handle = (channel, action) => {
    electron.ipcMain.handle(channel, async (event, input) => {
      if (
        event.senderFrame !== event.sender.mainFrame ||
        !host.applicationOf(event.sender)
      )
        return {
          success: false,
          code: "APPLICATION_CONTEXT_INVALID",
          error: "请在已登记的应用页面操作",
        };
      try {
        return await action(event.sender, input || {});
      } catch (error) {
        return {
          success: false,
          code: error.code || "ACTION_FAILED",
          error: error.guidance
            ? "请在个人中心登录、核对软件资格或重试连接，当前草稿保留。"
            : error.message,
          guidance: !!error.guidance,
        };
      }
    });
    handlers.push(channel);
  };
  handle(C.WINDOW_MINIMIZE, (contents) => {
    views.windowOf(contents).minimize();
    return { success: true };
  });
  handle(C.WINDOW_CLOSE, (contents) => {
    views.windowOf(contents).close();
    return { success: true };
  });
  handle(C.WINDOW_TOGGLE_MAXIMIZE, (contents) => {
    const window = views.windowOf(contents);
    window.isMaximized() ? window.unmaximize() : window.maximize();
    return { maximized: window.isMaximized() };
  });
  handle(C.WINDOW_IS_MAXIMIZED, (contents) => ({
    maximized: views.windowOf(contents).isMaximized(),
  }));
  handle(C.APPLICATION_HOST, async (contents, input) => {
    const principal = host.applicationOf(contents),
      id = input.applicationId;
    if (input.action === "close-answer")
      return { success: closeRequests.answer(contents, input.id, input.allow) };
    if (input.action === "metadata")
      return {
        success: true,
        value: {
          applicationId: principal,
          applications: catalog.list(),
          sessions: host.list(),
          windowId: views.windowOf(contents)?.id,
          combinationAllowed: true,
          installation: catalog.installation(),
          theme: catalog.theme(),
        },
      };
    if (input.action === "account-read")
      return {
        success: true,
        value: {
          ...(await account.snapshot()),
          currentApplication: {
            applicationId: principal,
            ...account.status(principal),
          },
        },
      };
    if (input.action === "account-workspace-open") {
      await account.openWorkspace(contents, input);
      return { success: true };
    }
    if (input.action === "account-workspace-resize") {
      await account.resizeWorkspace(contents, input);
      return { success: true };
    }
    if (input.action === "account-workspace-close") {
      account.closeWorkspace(contents, input.id);
      return { success: true };
    }
    if (input.action === "account-sign-in") {
      if (
        typeof input.id !== "string" ||
        !/^login-(?:[0-9]+|[0-9a-f-]{36})$/.test(input.id)
      )
        throw failure("ACCOUNT_REQUEST_INVALID", "请重新打开个人中心");
      if (signIns.size)
        throw failure("ACCOUNT_BUSY", "请在已有认证页完成或取消后重试");
      const controller = new AbortController(),
        abort = () => controller.abort();
      signIns.set(contents.id, { id: input.id, controller });
      contents.once("destroyed", abort);
      try {
        await account.signIn(controller.signal);
        return { success: true };
      } finally {
        signIns.delete(contents.id);
        contents.removeListener("destroyed", abort);
      }
    }
    if (input.action === "account-cancel-sign-in") {
      const value = signIns.get(contents.id);
      if (value?.id === input.id) value.controller.abort();
      return { success: true };
    }
    if (input.action === "account-sign-out") {
      await account.signOut();
      return { success: true };
    }
    if (input.action === "account-store") {
      await account.openStore(id);
      return { success: true };
    }
    if (input.action === "account-register") {
      await account.openRegistration();
      return { success: true };
    }
    if (input.action === "open") {
      ensureApplication(id);
      const own = host.list().find((item) => item.applicationId === principal);
      await host.open(id, { windowId: own.windowId });
      notify();
      return { success: true };
    }
    if (input.action === "split")
      return { success: true, value: await host.split(principal) };
    if (input.action === "merge") {
      const target = host.list().find((item) => item.applicationId === id);
      if (!target) throw failure("SESSION_NOT_FOUND", "请先打开需要合并的应用");
      await host.merge(principal, target.windowId);
      notify();
      return { success: true };
    }
    if (principal !== catalog.SHELL_ID)
      throw failure("CAPABILITY_DENIED", "请从框架应用中心管理软件或公共设置");
    if (input.action === "shell-add") {
      const selected = await electron.dialog.showOpenDialog(
        views.windowOf(contents),
        { title: "选择软件安装目录", properties: ["openDirectory"] },
      );
      if (selected.canceled) return { success: true, value: null };
      const entry = await catalog.add(selected.filePaths[0]);
      ensureApplication(entry.id);
      notify();
      return { success: true, value: entry };
    }
    if (input.action === "shell-theme") {
      catalog.saveTheme(input.theme);
      notify();
      return { success: true };
    }
    if (input.action === "shell-enable") {
      if (!input.enabled) await closeApplication(id);
      catalog.setEnabled(id, input.enabled);
      notify();
      return { success: true };
    }
    if (input.action === "shell-remove") {
      await closeApplication(id);
      catalog.remove(id);
      host.unregister(id);
      notify();
      return { success: true };
    }
    if (input.action === "review-local-update")
      return { success: true, value: catalog.modules.review(id) };
    if (input.action === "refresh-local-update") {
      await closeApplication(id);
      catalog.modules.refresh(id, input.token);
      host.unregister(id);
      ensureApplication(id);
      notify();
      return { success: true };
    }
    throw failure("HOST_ACTION_INVALID", "请选择框架提供的操作");
  });
  return () => {
    for (const pending of signIns.values()) pending.controller.abort();
    signIns.clear();
    for (const channel of handlers) electron.ipcMain.removeHandler(channel);
  };
}
module.exports = { registerController };
