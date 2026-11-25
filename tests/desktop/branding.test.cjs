const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { _electron: electron, expect } = require('@playwright/test');
const { rememberApp, closeApp } = require('../helpers/electron-close.cjs');
const runtime = require('@cxx/host-runtime');
const { systemIdentity } = require('@cxx/host-runtime/system-identity');
const { createApplicationModules } = require('@cxx/host-runtime/application-modules');
const { inspectApplication } = require('@cxx/host-runtime/installation-discovery');

for (const packaged of [false, true]) test(
  '独立主程序菜单保留两种软件图标、缺失回退和窗口品牌：' + (packaged ? '打包' : '开发'),
  { timeout: 60000 }, async t => {
    const data = fs.mkdtempSync(path.join(process.env.CXX_TEST_SESSION_ROOT, 'branding-'));
    const environment = runtime.resolveEnvironment({
      options: runtime.launchOptions(['--test-root=' + data], {}),
      locatorFile: '', defaultRoot: data, codeSource: data, userId: systemIdentity(),
    });
    const modules = createApplicationModules(environment), codes = [];
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64');
    for (const [id, name, icon] of [
      ['source-derived', 'cxx-repodock', fs.readFileSync(path.resolve('desktop/dist/shell-icon.png'))],
      ['deploy-flow', 'cxx-deploy-flow', png],
      ['other-app', 'other-product', png], ['missing-icon', 'missing-product', null],
    ]) {
      const root = path.join(data, id); fs.mkdirSync(root);
      fs.writeFileSync(path.join(root, 'preload.cjs'), '');
      fs.writeFileSync(path.join(root, 'entry.cjs'),
        "exports.createApplication=async()=>({load:view=>view.webContents.loadURL('data:text/html,<h1>Opened application</h1>'),dispose:async()=>{}})");
      if (icon) fs.writeFileSync(path.join(root, 'brand.png'), icon);
      fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name, productName: name,
        version: '1.0.0', cxxApplication: { id, productCode: id === 'source-derived' ? 'cxx-repodock' : id, entry: 'entry.cjs', preload: 'preload.cjs', icon: 'brand.png' } }));
      modules.register(inspectApplication(root));
    }
    const server = http.createServer((request, response) => {
      const url = new URL(request.url, 'http://127.0.0.1');
      if (url.pathname !== '/api/v1/catalog/runtime-policies') { response.writeHead(404).end(); return; }
      const selected = url.searchParams.getAll('productCodes').flatMap(value => value.split(','));
      codes.push(...selected);
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(selected.filter(code => ['cxx-repodock', 'deploy-flow'].includes(code)).map(productCode =>
        ({ productCode, name: 'RepoDock', mode: 'FREE', version: '-1' }))));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const store = runtime.createStorage(environment);
    require('@cxx/host-runtime/files').writeJson(store.file('settings', 'common', 'identity', 'connection.json'),
      { issuer: 'http://127.0.0.1:' + server.address().port });
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
    const app = rememberApp(await electron.launch({
      ...(packaged ? { executablePath: path.resolve('dist/test/win-unpacked/CXX Shell.exe') } : {}),
      args: [...(packaged ? [] : [path.resolve('.')]), '--test-root=' + data, '--disable-gpu'],
      env, timeout: 20000,
    }));
    try {
      await expect.poll(() => app.context().pages().find(page => page.url().endsWith('/index.html'))?.url()).toBeTruthy();
      const page = app.context().pages().find(page => page.url().endsWith('/index.html'));
      await expect(page.getByRole('heading', { name: '应用中心', exact: true })).toBeVisible();
      const metadata = await page.evaluate(() => window.cxxHost.request({ action: 'metadata' }));
      assert.equal(metadata.success, true);
      const apps = metadata.value.applications.filter(item => !item.infrastructure);
      assert.equal(apps.find(item => item.id === 'source-derived').productCode, 'cxx-repodock');
      assert.notEqual(apps[0].icon, apps[1].icon);
      await page.getByRole('button', { name: '切换应用', exact: true }).click();
      for (const name of ['cxx-repodock', 'cxx-deploy-flow', 'other-product', 'missing-product']) {
        const menuItem = page.getByRole('menuitem', { name, exact: true });
        await expect(menuItem).toBeVisible();
        const image = menuItem.locator('img').first();
        await expect(image).toBeVisible();
        assert.equal(await image.evaluate(img => img.complete && img.naturalWidth > 0), true);
      }
      const evidence = path.resolve('.local/shell-entry-evidence'); fs.mkdirSync(evidence, { recursive: true });
      // 隐藏原生窗口不产生截图帧；后台仍核对菜单、DOM 与原生窗口。
      if (process.env.PLAYWRIGHT_TEST !== "1")
      await page.screenshot({ path: path.join(evidence, 'menu-' + packaged + '.png') });
      const handle = await app.evaluate(({ BaseWindow }) => BaseWindow.getAllWindows()[0].getNativeWindowHandle().readBigUInt64LE().toString());
      const icon = require('../helpers/window-icon.cjs').nativeWindowIcon(handle);
      assert.match(icon, /^-?\d+$/);
      assert.notEqual(icon, '0', '本次原生窗口应持有实际图标');
      await page.keyboard.press('Escape');
      const { acquireKernel } = require('@cxx/host-runtime/kernel');
      for (const applicationId of ['source-derived', undefined]) {
        const forwarded = await acquireKernel(environment, { sourceId: 'cxx-shell:' + require('../../package.json').version, applicationId,
          open: async () => { throw Error('已有主程序时不应创建测试内核'); } });
        assert.equal(forwarded.primary, false);
        assert.deepEqual(await app.evaluate(({ BaseWindow }) => BaseWindow.getAllWindows().map(window => window.getTitle())), ['cxx-repodock']);
      }
      const executable = await app.evaluate(() => process.execPath);
      const launchAgain = require('node:util').promisify(require('node:child_process').execFile);
      for (const applicationId of ['source-derived', undefined]) {
        await launchAgain(executable, [
          ...(packaged ? [] : [path.resolve('.')]), '--test-root=' + data, '--disable-gpu',
          ...(applicationId ? ['--application=' + applicationId] : []),
        ], { env: { ...env, PLAYWRIGHT_TEST: '1' }, windowsHide: true, timeout: 20000 });
        assert.deepEqual(await app.evaluate(({ BaseWindow }) => BaseWindow.getAllWindows().map(window => window.getTitle())), ['cxx-repodock']);
      }
      const opened = await page.evaluate(() => window.cxxHost.request({ action: 'open', applicationId: 'source-derived' }));
      assert.equal(opened.success, true, JSON.stringify(opened));
      assert.ok(codes.includes('cxx-repodock'));
      assert.equal(codes.includes('source-derived'), false);
      const deployed = await page.evaluate(() => window.cxxHost.request({ action: 'open', applicationId: 'deploy-flow' }));
      assert.equal(deployed.success, true, JSON.stringify(deployed));
      assert.ok(codes.includes('deploy-flow'));
      assert.equal(codes.includes('cxx-deploy-flow'), false);
      const denied = await page.evaluate(() => window.cxxHost.request({ action: 'open', applicationId: 'other-app' }));
      assert.equal(denied.success, false);
    } finally { await closeApp(app, { force: true }); }
  });
