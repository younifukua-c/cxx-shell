const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), http = require('node:http');
const runtime = require('@cxx/host-runtime');
const { inspectApplication } = require('@cxx/host-runtime/installation-discovery');
const { createApplicationModules } = require('@cxx/host-runtime/application-modules');
const { createDesktopAccount } = require('@cxx/host-runtime/account');

const products = [
  { id: 'source-derived', name: 'cxx-repodock', productCode: 'cxx-repodock' },
  { id: 'deploy-flow', name: 'cxx-deploy-flow', productCode: 'deploy-flow' },
  { id: 'paid-app', name: 'paid-package', productCode: 'paid-product' },
  { id: 'unknown-app', name: 'unknown-package', productCode: 'unknown-product' },
];
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'product-contract-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const environment = runtime.resolveEnvironment({ options: runtime.launchOptions(['--test-root=' + path.join(root, 'data')], {}),
    locatorFile: '', defaultRoot: root, codeSource: root, userId: 'fixture' });
  const modules = createApplicationModules(environment);
  for (const product of products) {
    const dir = path.join(root, product.id); fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'entry.cjs'), 'exports.createApplication=()=>({})');
    fs.writeFileSync(path.join(dir, 'preload.cjs'), '');
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: product.name, version: '1.0.0',
      cxxApplication: { id: product.id, productCode: product.productCode, entry: 'entry.cjs', preload: 'preload.cjs' } }));
    modules.register(inspectApplication(dir));
  }
  return { root, environment, modules };
}
async function accountFixture(t, environment, listApplications) {
  const seen = [];
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname !== '/api/v1/catalog/runtime-policies') { response.writeHead(404).end(); return; }
    const codes = url.searchParams.getAll('productCodes').flatMap(code => code.split(','));
    seen.push(...codes); response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(codes.filter(code => ['cxx-repodock', 'deploy-flow', 'paid-product'].includes(code))
      .map(productCode => ({ productCode, name: productCode, mode: productCode === 'paid-product' ? 'SUBSCRIPTION' : 'FREE', version: '-1' }))));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const account = createDesktopAccount({
    electron: { session: { fromPartition: () => ({ setPermissionRequestHandler() {}, setPermissionCheckHandler() {} }) } },
    environment, configuration: { issuer: 'http://127.0.0.1:' + server.address().port,
      websiteOrigin: 'http://127.0.0.1:' + server.address().port }, listApplications,
    createProvider: async options => (await import('@cxx/scc-sdk/desktop')).createSccAccountProvider(options),
  });
  t.after(() => account.destroy());
  return { account, seen };
}

test('真实SDK按显式产品编码同时放行两个免费产品，订阅和未知仍拒绝', async t => {
  const f = fixture(t), a = await accountFixture(t, f.environment, f.modules.list);
  await a.account.require('source-derived');
  await a.account.require('deploy-flow');
  await assert.rejects(a.account.require('paid-app'));
  await assert.rejects(a.account.require('unknown-app'));
  assert.deepEqual(a.seen, ['cxx-repodock', 'deploy-flow', 'paid-product', 'unknown-product']);
  assert.equal(a.account.status('source-derived').allowed, true);
  assert.equal(a.account.status('deploy-flow').allowed, true);
});

test('0.14.4旧推断登记只读迁移，显式编码变更仍必须核对', t => {
  const f = fixture(t);
  const store = runtime.createStorage(f.environment);
  const file = store.file('settings', 'common', 'host-runtime', 'modules/deploy-flow.json');
  const old = JSON.parse(fs.readFileSync(file)); old.module.productCode = 'cxx-deploy-flow';
  delete old.module.productCodeSource; fs.writeFileSync(file, JSON.stringify(old));
  const before = fs.readFileSync(file, 'utf8');
  assert.equal(f.modules.list().find(item => item.id === 'deploy-flow').productCode, 'deploy-flow');
  assert.equal(f.modules.resolve('deploy-flow').id, 'deploy-flow');
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  const root = path.join(f.root, 'deploy-flow'), pkgFile = path.join(root, 'package.json');
  f.modules.register(inspectApplication(root));
  const pkg = JSON.parse(fs.readFileSync(pkgFile)); pkg.cxxApplication.productCode = 'other-product';
  fs.writeFileSync(pkgFile, JSON.stringify(pkg));
  assert.throws(() => f.modules.resolve('deploy-flow'), { code: 'MODULE_CHANGED' });
});

test('两个实际安装清单在隔离SDK入口均可匿名核验，不加载产品工厂或改资料', {
  skip: !process.env.CXX_IDENTITY_PRODUCT_ROOTS,
}, async t => {
  const f = fixture(t);
  for (const id of products.map(item => item.id)) f.modules.unregister(id);
  const roots = JSON.parse(process.env.CXX_IDENTITY_PRODUCT_ROOTS);
  for (const root of roots) f.modules.register(inspectApplication(root));
  const a = await accountFixture(t, f.environment, f.modules.list);
  for (const product of products.slice(0, 2)) {
    assert.equal(f.modules.list().find(item => item.id === product.id).productCode, product.productCode);
    await a.account.require(product.id);
  }
  assert.deepEqual(a.seen, ['cxx-repodock', 'deploy-flow']);
});

test('未声明编码的旧软件继续用应用ID，显式空值和非法类型不能降级为免费产品', t => {
  const f = fixture(t), file = path.join(f.root, 'paid-app/package.json');
  const pkg = JSON.parse(fs.readFileSync(file));
  delete pkg.cxxApplication.productCode; fs.writeFileSync(file, JSON.stringify(pkg));
  assert.equal(inspectApplication(path.dirname(file)).productCode, 'paid-app');
  for (const value of ['', null, ['deploy-flow'], { id: 'deploy-flow' }, '../deploy-flow']) {
    pkg.cxxApplication.productCode = value; fs.writeFileSync(file, JSON.stringify(pkg));
    assert.throws(() => inspectApplication(path.dirname(file)), { code: 'MODULE_DEFINITION_INVALID' });
  }
});

test('任意外部字段不能借用免费商品，目录展示重新核对安装声明而非篡改登记', async t => {
  const f = fixture(t);
  const file = runtime.createStorage(f.environment).file('settings', 'common', 'host-runtime', 'modules/paid-app.json');
  const saved = JSON.parse(fs.readFileSync(file)); saved.module.productCode = 'deploy-flow';
  fs.writeFileSync(file, JSON.stringify(saved));
  assert.equal(f.modules.list().find(item => item.id === 'paid-app').productCode, 'paid-product');
  assert.throws(() => f.modules.resolve('paid-app'), { code: 'MODULE_CHANGED' });
  const seen = [];
  const account = createDesktopAccount({
    electron: { session: { fromPartition: () => ({ setPermissionRequestHandler() {}, setPermissionCheckHandler() {} }) } },
    environment: f.environment, configuration: { websiteOrigin: 'https://identity.test' },
    listApplications: () => [{ id: 'paid-app', name: '收费软件', external: true, productCode: 'deploy-flow', infrastructure: true }],
    createProvider: options => ({ check: async ids => {
      seen.push(options.listApplications()[0].productCode);
      return ids.map(applicationId => ({ applicationId, allowed: false, reason: 'NO_SUBSCRIPTION',
        evaluatedAt: new Date().toISOString(), validUntil: null }));
    }, destroy() {} }),
  });
  t.after(() => account.destroy());
  await assert.rejects(account.require('paid-app'));
  assert.deepEqual(seen, ['paid-app']);
});

test('直接旧登记后来增加同版本package声明仍可解析，版本与入口变动才要求核对', t => {
  const f = fixture(t), root = path.join(f.root, 'legacy-app'); fs.mkdirSync(root);
  fs.writeFileSync(path.join(root, 'entry.cjs'), 'exports.createApplication=()=>({})');
  fs.writeFileSync(path.join(root, 'preload.cjs'), '');
  const definition = { id: 'legacy-app', name: 'Legacy', entry: 'entry.cjs', preload: 'preload.cjs' };
  f.modules.register({ ...definition, root, version: '1.0.0' });
  const pkg = { name: 'different-package', version: '1.0.0', cxxApplication: definition };
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(pkg));
  assert.equal(f.modules.resolve('legacy-app').productCode, 'legacy-app');
  pkg.version = '1.1.0'; fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(pkg));
  assert.throws(() => f.modules.resolve('legacy-app'), { code: 'MODULE_CHANGED' });
});

test('单个部署流安装目录被重定向时隔离故障，源派生及公共账户仍可操作', async t => {
  const f = fixture(t), source = path.join(f.root, 'deploy-flow'), moved = path.join(f.root, 'moved-deploy');
  fs.renameSync(source, moved);
  fs.symlinkSync(moved, source, process.platform === 'win32' ? 'junction' : 'dir');
  const entries = f.modules.list();
  const broken = entries.find(item => item.id === 'deploy-flow');
  assert.equal(broken.root, source);
  assert.equal(broken.unavailable.code, 'MODULE_UNAVAILABLE');
  assert.match(broken.unavailable.message, /安装位置/);
  assert.equal(f.modules.resolve('source-derived').id, 'source-derived');
  assert.throws(() => f.modules.resolve('deploy-flow'), { code: 'MODULE_IDENTITY_CHANGED' });
  const a = await accountFixture(t, f.environment, f.modules.list);
  await a.account.require('source-derived');
  await assert.rejects(a.account.require('deploy-flow'), { code: 'MODULE_UNAVAILABLE' });
  const snapshot = await a.account.snapshot();
  assert.equal(snapshot.software.find(item => item.applicationId === 'source-derived').allowed, true);
  assert.equal(snapshot.software.find(item => item.applicationId === 'deploy-flow').allowed, false);
  assert.equal(a.seen.includes('deploy-flow'), false);
});
