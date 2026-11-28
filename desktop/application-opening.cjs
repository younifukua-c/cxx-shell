"use strict";
const C = require("@cxx/host-runtime/host-channels");
const { failure } = require("@cxx/host-runtime/files");

/** 启动器与菜单共用打开策略；缺省激活保留当前应用，显式拆窗由会话能力处理。 */
function createApplicationOpening({
  host,
  views,
  ensureApplication,
  fallbackId,
}) {
  const activations = new Map();
  const navigation = new Map();
  const pendingNavigation = new Map();
  let navigationRevision = 0;
  let initialOpening,
    disposed = false;
  async function activate(requested, options) {
    if (disposed) throw failure("HOST_CLOSED", "应用宿主已退出");
    const sessions = host.list();
    const windows = options.windowId === undefined ? views.windows() : [];
    const preferred =
      windows.find((window) => window.isFocused()) || windows[0];
    const target = options.windowId ?? preferred?.id;
    const current =
      !requested &&
      sessions.find(
        (session) =>
          session.windowId === target &&
          views.activeWindowOf(host.contents(session.applicationId))?.id ===
            target,
      );
    const id = requested || current?.applicationId || fallbackId;
    ensureApplication(id);
    const requestedNavigation = options.entryId
      ? { entryId: options.entryId, revision: ++navigationRevision }
      : undefined;
    if (requestedNavigation) pendingNavigation.set(id, requestedNavigation);
    const existing = sessions.find((session) => session.applicationId === id);
    const windowId = existing?.windowId ?? target;
    const key = windowId ?? "initial";
    const activation = {};
    activations.set(key, activation);
    try {
      const session = await host.open(id, { windowId, activate: false });
      if (!disposed && activations.get(key) === activation) {
        await host.focus(id);
        const contents = !disposed && activations.get(key) === activation && host.contents(id);
        if (contents && !contents.isDestroyed())
          contents.send(C.APPLICATION_HOST_CHANGED, {
            kind: "application-activated",
            applicationId: id,
            ...(requestedNavigation || navigation.get(id) || {}),
          });
      }
      if (!disposed && requestedNavigation && requestedNavigation.revision > (navigation.get(id)?.revision || 0))
        navigation.set(id, requestedNavigation);
      return session;
    } finally {
      if (pendingNavigation.get(id) === requestedNavigation) pendingNavigation.delete(id);
      if (activations.get(key) === activation) activations.delete(key);
    }
  }
  const open = async (id, options = {}) => {
    if (
      !initialOpening &&
      (options.windowId !== undefined || views.windows().length)
    )
      return activate(id, options);
    const previous = initialOpening;
    const task = (previous ? previous.catch(() => {}) : Promise.resolve()).then(
      () => activate(id, options),
    );
    initialOpening = task;
    try {
      return await task;
    } finally {
      if (initialOpening === task) initialOpening = undefined;
    }
  };
  open.navigationOf = (id) => pendingNavigation.get(id) || navigation.get(id);
  open.dispose = () => {
    navigation.clear();
    pendingNavigation.clear();
    disposed = true;
    activations.clear();
    initialOpening = undefined;
  };
  return open;
}
module.exports = { createApplicationOpening };
