"use strict";
const path = require("node:path");
const {
  createApplicationModules,
} = require("@cxx/host-runtime/application-modules");
const { createStorage } = require("@cxx/host-runtime/storage");
const { readJson, writeJson, failure } = require("@cxx/host-runtime/files");
const SHELL_ID = "cxx-shell";
/** 沿用原应用中心登记，启用选择、安装位置和分组仍由同一文件持有。 */
function createCatalog(environment) {
  const storage = createStorage(environment);
  const file = storage.file(
    "settings",
    "common",
    "application-center",
    "applications.json",
  );
  const modules = createApplicationModules(environment);
  let state = readJson(file, {
    schemaVersion: 1,
    applications: {},
    groups: [],
  });
  if (
    state.schemaVersion !== 1 ||
    !state.applications ||
    typeof state.applications !== "object" ||
    Array.isArray(state.applications)
  )
    throw failure(
      "APPLICATION_REGISTRY_INVALID",
      "应用中心登记无法读取，请修复原记录后重试；原资料已保留。",
    );
  const status = (id) => state.applications[id];
  const enabled = (id) =>
    status(id)?.enabled !== false && status(id)?.installed !== false;
  const list = () => [
    { id: SHELL_ID, name: "应用中心", infrastructure: true, enabled: true },
    ...modules.list().map((item) => ({ ...item, installed: status(item.id)?.installed !== false, configuredEnabled: !item.unavailable && status(item.id)?.enabled !== false, enabled: !item.unavailable && enabled(item.id) })),
  ];
  const save = (next) => {
    writeJson(file, next);
    state = next;
  };
  return {
    modules,
    list,
    SHELL_ID,
    async add(directory) {
      const record =
        require("@cxx/host-runtime/installation-discovery").inspectApplication(
          directory,
        );
      if (
        record.id === SHELL_ID ||
        list().some((item) => item.id === record.id)
      )
        throw failure(
          "APPLICATION_ALREADY_ADDED",
          "此软件已加入，请直接打开或核对更新。",
        );
      modules.register(record);
      save({
        ...state,
        applications: {
          ...state.applications,
          [record.id]: { installed: true, enabled: true },
        },
      });
      return record;
    },
    setEnabled(id, value) {
      if (id === SHELL_ID || !modules.list().some((item) => item.id === id))
        throw failure("APPLICATION_UNKNOWN", "请选择已登记的业务软件。");
      save({
        ...state,
        applications: {
          ...state.applications,
          [id]: { ...status(id), installed: true, enabled: !!value },
        },
      });
    },
    remove(id) {
      if (id === SHELL_ID)
        throw failure("APPLICATION_UNKNOWN", "应用中心由框架持有。");
      modules.unregister(id);
    },
    theme: () => state.theme || "dark",
    saveTheme(theme) {
      if (!["dark", "light", "glass"].includes(theme))
        throw failure("THEME_INVALID", "请选择有效主题。");
      save({ ...state, theme });
    },
    canOpen: (id) =>
      id === SHELL_ID ||
      modules.list().some((item) => item.id === id && !item.unavailable && enabled(id)),
    installation: () => ({
      directory:
        state.installationRoot || path.join(environment.root, "installation"),
    }),
  };
}
module.exports = { createCatalog, SHELL_ID };
