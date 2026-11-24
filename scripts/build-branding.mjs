import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';
const require = createRequire(import.meta.url);
/** 从已安装中央图标生成原生窗口 PNG，源码和打包启动使用同一资源。 */
export async function buildBranding(output) {
  const source = require.resolve('@cxx/icons/assets/38-workspace.svg');
  const browser = await chromium.launch({ channel: process.env.CXX_TEST_BROWSER_CHANNEL || 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 256, height: 256 } });
    await page.setContent('<style>html,body{margin:0;background:transparent}svg{width:256px;height:256px;display:block}</style>' +
      fs.readFileSync(source, 'utf8').replace(/<\?xml[^>]*\?>/, ''));
    await page.locator('svg').screenshot({ path: path.join(output, 'shell-icon.png'), omitBackground: true });
  } finally { await browser.close(); }
}
