const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const runtime = require('@cxx/host-runtime');
const { createApplicationModules } = require('@cxx/host-runtime/application-modules');
const { inspectApplication } = require('@cxx/host-runtime/installation-discovery');
const { createDesktopAccount } = require('@cxx/host-runtime/account');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shell-entry-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const environment = runtime.resolveEnvironment({
    options: runtime.launchOptions(['--test-root=' + path.join(root, 'data')], {}),
    locatorFile: '', defaultRoot: root, codeSource: root, userId: 'fixture',
  });
  const modules = createApplicationModules(environment);
  const add = (id, name, icon) => {
    const dir = path.join(root, id); fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'entry.cjs'), 'exports.createApplication=()=>({})');
    fs.writeFileSync(path.join(dir, 'preload.cjs'), '');
    if (icon) fs.writeFileSync(path.join(dir, icon), png);
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
      name, version: '1.0.0', cxxApplication: { id, entry: 'entry.cjs', preload: 'preload.cjs', icon },
    }));
    modules.register(inspectApplication(dir)); return dir;
  };
  return { root, environment, modules, add };
}

test('应用内部 ID 与中央产品编码独立，保留旧登记和真实软件图标', t => {
  const f = fixture(t);
  const dir = f.add('source-derived', 'cxx-repodock', 'brand.png');
  const moduleFile = runtime.createStorage(f.environment).file('settings', 'common', 'host-runtime', 'modules/source-derived.json');
  // 已有登记不要求用户重新加入，也不改内部 ID 或写回资料。
  const old = JSON.parse(fs.readFileSync(moduleFile));
  delete old.module.productCode; delete old.module.iconPath;
  fs.writeFileSync(moduleFile, JSON.stringify(old)); const before = fs.readFileSync(moduleFile, 'utf8');
  const [entry] = f.modules.list();
  const manifestFile = path.join(dir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(manifestFile));
  pkg.cxxApplication.productCode = 'different-free-product';
  fs.writeFileSync(manifestFile, JSON.stringify(pkg));
  assert.equal(entry.id, 'source-derived');
  assert.equal(entry.productCode, 'cxx-repodock');
  assert.match(entry.icon, /^data:image\/png;base64,/);
  assert.equal(entry.windowIcon, path.join(dir, 'brand.png'));
  assert.equal(f.modules.resolve(entry.id).id, entry.id);
  assert.equal(fs.readFileSync(moduleFile, 'utf8'), before);
  // 新登记绑定产品编码，安装包身份变更必须经过已有更新核对。
  f.modules.register(inspectApplication(dir));
  pkg.name = 'changed-product'; fs.writeFileSync(manifestFile, JSON.stringify(pkg));
  assert.throws(() => f.modules.resolve(entry.id), { code: 'MODULE_CHANGED' });
});

test('中央免费产品匿名允许，订阅、未知产品仍拒绝，外部软件不能声明自己为基建', async t => {
  const f = fixture(t);
  f.add('source-derived', 'cxx-repodock');
  f.add('paid-app', 'paid-product'); f.add('unknown-app', 'unknown-product');
  let applications;
  const checked = [];
  const account = createDesktopAccount({
    electron: { session: { fromPartition: () => ({ setPermissionRequestHandler() {}, setPermissionCheckHandler() {} }) } },
    environment: f.environment, configuration: { websiteOrigin: 'https://identity.test' },
    listApplications: () => f.modules.list().map(item => ({ ...item, infrastructure: true, demo: true })),
    createProvider: options => {
      applications = options.listApplications;
      return { check: async ids => ids.map(id => {
        const item = applications().find(value => value.id === id);
        checked.push(item.productCode);
        return { applicationId: id, evaluatedAt: new Date().toISOString(), validUntil: null, allowed: item.productCode === 'cxx-repodock',
          reason: item.productCode === 'cxx-repodock' ? 'FREE' : 'NO_SUBSCRIPTION' };
      }), snapshot: () => ({ identity: null, software: [] }), destroy() {} };
    },
  });
  t.after(() => account.destroy());
  await account.require('source-derived');
  await assert.rejects(account.require('paid-app'));
  await assert.rejects(account.require('unknown-app'));
  assert.deepEqual(checked, ['cxx-repodock', 'paid-product', 'unknown-product']);
  assert.equal(account.status('source-derived').allowed, true);
  assert.ok(applications().every(item => !item.infrastructure && !item.demo));
});

test('软件图标只能来自安装目录，缺失资源受控回退，不读取目录外文件', t => {
  const f = fixture(t); const dir = f.add('example', 'example-product', 'brand.png');
  fs.unlinkSync(path.join(dir, 'brand.png'));
  assert.equal(f.modules.list()[0].icon, undefined);
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json')));
  pkg.cxxApplication.icon = '../private.png';
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg));
  assert.throws(() => inspectApplication(dir), { code: 'PATH_OUTSIDE_ROOT' });
});
