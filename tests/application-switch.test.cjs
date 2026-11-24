'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { createApplicationHost } = require('@cxx/host-runtime/application-host');
const { registerController } = require('../desktop/controller.cjs');
const C = require('@cxx/host-runtime/host-channels');

test('先点慢应用再点另一应用，迟到加载不能抢回当前工作区；重复打开只创建一份视图', async () => {
  let finishSlow, entered;
  const started = new Promise(resolve => { entered = resolve; });
  const slow = new Promise(resolve => { finishSlow = resolve; });
  const focused = [], handlers = new Map(), created = [];
  const views = {
    createWindow: () => 1,
    createView(entry) { const view = { webContents: { isDestroyed: () => false, close() {}, send() {} } };
      created.push(entry.id); return view; },
    attach: async () => {}, confirm: async () => {}, closeEmpty: async () => {},
    focus: async session => { focused.push(session.applicationId); }, destroy() {},
    windowOf: () => ({ id: 1 }),
  };
  const host = createApplicationHost({ viewHost: views, applications: [
    { id: 'cxx-shell', name: '应用中心', load: async () => {} },
    { id: 'source-derived', name: '源·派生', load: async () => { entered(); await slow; } },
    { id: 'deploy-flow', name: '部署流', load: async () => {} },
  ] });
  await host.open('cxx-shell');
  const sender = host.contents('cxx-shell'); sender.mainFrame = {};
  const stop = registerController({ electron: { ipcMain: { handle: (channel, action) => handlers.set(channel, action),
    removeHandler: channel => handlers.delete(channel) } }, host, views,
    catalog: { SHELL_ID: 'cxx-shell' }, account: {}, closeRequests: {}, ensureApplication() {}, notify() {} });
  try {
    const request = id => handlers.get(C.APPLICATION_HOST)({ sender, senderFrame: sender.mainFrame }, { action: 'open', applicationId: id });
    const first = request('source-derived'); await started;
    const repeated = request('source-derived');
    assert.equal((await request('deploy-flow')).success, true);
    finishSlow(); await Promise.all([first, repeated]);
    assert.equal(focused.at(-1), 'deploy-flow');
    assert.equal(created.filter(id => id === 'source-derived').length, 1);
    assert.equal(host.list().length, 3);
  } finally { stop(); host.destroy(); }
});
