const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { _electron: electron, expect } = require('@playwright/test');
const { rememberApp, closeApp } = require('../helpers/electron-close.cjs');
const runtime = require('@cxx/host-runtime');
const menus=require('../helpers/application-menu.cjs');
const { createApplicationModules } = require('@cxx/host-runtime/application-modules');
const { inspectApplication } = require('@cxx/host-runtime/installation-discovery');
const { systemIdentity } = require('@cxx/host-runtime/system-identity');

test('真实Shell正常入口匿名打开实际RepoDock与部署流，切回保留会话及原登记', {
  timeout: 120000, skip: !process.env.CXX_IDENTITY_PRODUCT_ROOTS,
}, async t => {
  const data = fs.mkdtempSync(path.join(process.env.CXX_TEST_SESSION_ROOT, 'actual-products-'));
  const environment = runtime.resolveEnvironment({ options: runtime.launchOptions(['--test-root=' + data], {}),
    locatorFile: '', defaultRoot: data, codeSource: data, userId: systemIdentity() });
  const roots = JSON.parse(process.env.CXX_IDENTITY_PRODUCT_ROOTS);
  const modules = createApplicationModules(environment);
  for (const root of roots) modules.register(inspectApplication(root));
  const seen = [];
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname !== '/api/v1/catalog/runtime-policies') { response.writeHead(404).end(); return; }
    const codes = url.searchParams.getAll('productCodes').flatMap(code => code.split(','));
    seen.push(...codes);
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(codes.filter(code => ['cxx-repodock', 'deploy-flow'].includes(code))
      .map(productCode => ({ productCode, name: productCode, mode: 'FREE', version: '-1' }))));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const store = runtime.createStorage(environment);
  require('@cxx/host-runtime/files').writeJson(store.file('settings', 'common', 'identity', 'connection.json'),
    { issuer: 'http://127.0.0.1:' + server.address().port });
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
  const app = rememberApp(await electron.launch({
    args: [path.resolve('.'), '--test-root=' + data, '--disable-gpu'], env, timeout: 30000,
  }));
  try {
    await expect.poll(() => app.context().pages().find(page => page.url().endsWith('/index.html'))?.url()).toBeTruthy();
    const shell = app.context().pages().find(page => page.url().endsWith('/index.html'));
    await expect(shell.getByRole('heading', { name: '应用中心', exact: true })).toBeVisible();
    let current = shell;
    const menuSnapshots = [];
    for (const [id, code, name] of [['source-derived', 'cxx-repodock', '源·派生'], ['deploy-flow', 'deploy-flow', '部署流']]) {
      await menus.choose(current,name,id==='deploy-flow'?'服务器':name);
      await expect.poll(() => app.context().pages().find(page => id === 'source-derived'
        ? page.url().endsWith('/src/index.html') : /^http:\/\/127\.0\.0\.1:/.test(page.url()))?.url(), { timeout: 60000 }).toBeTruthy();
      current = app.context().pages().find(page => id === 'source-derived'
        ? page.url().endsWith('/src/index.html') : /^http:\/\/127\.0\.0\.1:/.test(page.url()));
      await expect(current.locator('.cxx-shell-switch button').first()).toBeVisible({ timeout: 30000 });
      if (id === 'source-derived') {
        await current.getByRole('button', { name: '稍后配置', exact: true }).click();
        await expect(current.locator('#onboarding-modal')).toBeHidden();
      }
      await current.locator('.cxx-shell-switch button').first().click();
      menuSnapshots.push({id,roots:await menus.roots(current),branches:await menus.branches(current)});
      assert.deepEqual(menuSnapshots.at(-1).branches,{'源·派生':['源·派生','进程管理'],'部署流':['部署流','部署组件','关系网','服务器','客户']});
      console.log('[menu-contract]',JSON.stringify(menuSnapshots));
      assert.ok(!menuSnapshots.at(-1).roots.includes('进程管理'),'应用自己的功能不能出现在一级');
      assert.ok(!menuSnapshots.at(-1).roots.includes('应用中心'),'应用中心不能取代应用菜单');
      fs.writeFileSync(path.join(process.env.CXX_TEST_ARTIFACTS_DIR,'menu-roots.json'),JSON.stringify(menuSnapshots,null,2));
      await current.keyboard.press('Escape');
      if (menuSnapshots.length > 1) assert.deepEqual(menuSnapshots[1].roots, menuSnapshots[0].roots, '切换应用不得改变一级菜单');
      if(id==='deploy-flow') {
        await expect(current.locator('.cxx-shell-switch button').first()).toContainText('服务器');
        await menus.choose(current,'部署流');
      }
      const account = await shell.evaluate(() => window.cxxHost.account.request({ action: 'account-read' }));
      assert.equal(account.value.identity, null);
      assert.equal(account.value.software.find(item => item.applicationId === id).allowed, true);
      assert.ok(seen.includes(code));
    }
    const deployed = app.context().pages().find(page => /^http:\/\/127\.0\.0\.1:/.test(page.url()));
    assert.ok(deployed, '部署流应通过实际工厂进入本次独立后台工作区');
    await expect(deployed.locator('body')).toContainText('部署流');
    await deployed.locator('.cxx-shell-switch button').first().click();
    await expect(deployed.getByText('源·派生', { exact: true }).last()).toBeVisible();
    await expect(deployed.getByText('部署流', { exact: true }).last()).toBeVisible();
    await deployed.keyboard.press('Escape');
    await menus.choose(deployed,'源·派生');
    const source = app.context().pages().find(page => page.url().endsWith('/src/index.html'));
    await expect.poll(() => source.evaluate(() => document.visibilityState)).toBe('visible');
    await source.locator('.cxx-shell-switch button').first().click();
    await expect(source.getByText('部署流', { exact: true }).last()).toBeVisible();
    await expect(source.getByText('源·派生', { exact: true }).last()).toBeVisible();
    await source.keyboard.press('Escape');
    await menus.choose(source,'部署流','服务器');
    await expect.poll(()=>deployed.evaluate(()=>window.cxxHost.request({action:'metadata'}).then(result=>result.value.navigation?.entryId))).toBe('servers');
    await expect(deployed.locator('.cxx-shell-switch button').first()).toContainText('服务器');
    await menus.choose(deployed,'源·派生','进程管理');
    await expect(source.locator('.cxx-shell-switch button').first()).toContainText('进程管理');
    assert.equal(await app.evaluate(({ BaseWindow }) => BaseWindow.getAllWindows().length), 1);
    const metadata = await shell.evaluate(() => window.cxxHost.request({ action: 'metadata' }));
    assert.equal(metadata.value.sessions.filter(item => item.applicationId === 'source-derived').length, 1);
    assert.equal(metadata.value.sessions.filter(item => item.applicationId === 'deploy-flow').length, 1);
    assert.equal(seen.includes('cxx-deploy-flow'), false);
    assert.equal(seen.includes('source-derived'), false);
  } finally {
    assert.equal(await closeApp(app), 'closed', '正常退出必须等应用工厂释放后台和运行环境');
  }
});
