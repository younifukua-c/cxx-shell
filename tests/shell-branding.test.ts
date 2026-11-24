import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { applicationLinks } from '../desktop/renderer/application-links';
const require = createRequire(import.meta.url);
const { windowBranding } = require('../desktop/window-branding.cjs');

test('应用菜单保留不同软件图标与内部资格ID，缺资源使用统一回退', () => {
  assert.deepEqual(applicationLinks([
    { id: 'source-derived', name: '源·派生', icon: 'data:image/png;base64,one' },
    { id: 'deploy-flow', name: '部署流', icon: 'data:image/png;base64,two' },
    { id: 'missing', name: '缺失图标' },
  ], 'shell.svg'), [
    { id: 'source-derived', name: '源·派生', icon: 'data:image/png;base64,one', accessApplicationId: 'source-derived' },
    { id: 'deploy-flow', name: '部署流', icon: 'data:image/png;base64,two', accessApplicationId: 'deploy-flow' },
    { id: 'missing', name: '缺失图标', icon: 'shell.svg', accessApplicationId: 'missing' },
  ]);
});

test('公共窗口和子应用分别沿用自身品牌，缺资源回退到Shell', () => {
  const apps = [{ id: 'source-derived', name: '源·派生', windowIcon: 'repodock.png' },
    { id: 'deploy-flow', name: '部署流', windowIcon: 'deploy.png' }];
  assert.equal(windowBranding('source-derived', apps).icon, 'repodock.png');
  assert.equal(windowBranding('deploy-flow', apps).icon, 'deploy.png');
  assert.match(windowBranding('cxx-shell', apps).icon, /shell-icon\.png$/);
  assert.equal(windowBranding('cxx-shell', apps).title, require('../package.json').productName);
});
