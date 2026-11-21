"use strict";
const { contextBridge, ipcRenderer } = require("electron");
require("@cxx/host-runtime/preload-bridge").installHostBridge({
  contextBridge,
  ipcRenderer,
  channels: require("@cxx/host-runtime/host-channels"),
});
