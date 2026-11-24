import { test, expect } from '@playwright/test';
const root = '/@fs/' + process.cwd().replace(/\\/g, '/');
for (const theme of ['dark', 'light', 'glass']) test('软件切换等待显示骨架，菜单窗栏保持可用，失败保留草稿 · ' + theme, async ({ page }, testInfo) => {
  await page.goto('/');
  await page.evaluate(async ({ root, theme }) => {
    (window as any).shell?.destroy();
    document.body.replaceChildren();
    const { mountDomShell } = await import(root + '/packages/app-shell/src/dom.ts');
    const host = document.createElement('div'); document.body.append(host);
    const sidebar = document.createElement('nav'), main = document.createElement('main');
    const draft = document.createElement('textarea'); draft.setAttribute('aria-label', '保留的草稿'); draft.value = '未保存内容'; main.append(draft);
    (window as any).switchCalls = [];
    (window as any).switchFailures = [];
    (window as any).switchFinishes = [];
    (window as any).switchErrors = [];
    (window as any).shell = mountDomShell(host, { theme,
      apps: [{ id: 'deploy-flow', name: '部署流', accessApplicationId: null, sidebar, main }],
      applicationLinks: [{ id: 'source-derived', name: '源·派生', accessApplicationId: null }],
      windowHost: { minimize() {}, close() {}, toggleMaximize: async () => false, isMaximized: async () => false },
      onApplicationLink(id: string) {
        (window as any).switchCalls.push(id);
        return new Promise<void>((resolve, reject) => {
          (window as any).switchFailures.push(reject);
          (window as any).switchFinishes.push(resolve);
        });
      },
      onError(error: Error) { (window as any).switchErrors.push(error.message); },
    });
  }, { root, theme });
  await page.locator('.cxx-shell-switch button').first().click();
  await page.getByText('源·派生', { exact: true }).last().click();
  await expect(page.getByRole('status', { name: '正在打开源·派生' })).toBeVisible();
  await expect(page.locator('.cxx-shell-switch')).toBeVisible();
  await expect(page.locator('.cxx-window-titlebar')).toBeVisible();
  const skeleton = page.locator('.cxx-shell-opening-main .cxx-skeleton').first();
  const motion = await skeleton.evaluate(node => {
    const style = getComputedStyle(node, '::after');
    return { name: style.animationName, duration: style.animationDuration, transform: style.transform };
  });
  expect(motion.name).toBe('cxx-skeleton-sweep');
  expect(motion.duration).not.toBe('0s');
  await expect.poll(() => skeleton.evaluate(node => getComputedStyle(node, '::after').transform)).not.toBe(motion.transform);
  await page.screenshot({ path: testInfo.outputPath('switch-loading.png') });
  await page.locator('.cxx-shell-switch button').first().click();
  await expect(page.getByText('部署流', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('源·派生', { exact: true }).last()).toBeVisible();
  await page.getByText('源·派生', { exact: true }).last().click();
  await expect.poll(() => page.evaluate(() => (window as any).switchCalls)).toEqual(['source-derived']);
  await page.evaluate(() => (window as any).switchFailures[0](Error('连接暂不可用，请重试')));
  await expect(page.getByRole('status', { name: '正在打开源·派生' })).toBeHidden();
  await expect(page.getByRole('textbox', { name: '保留的草稿' })).toHaveValue('未保存内容');
  expect(await page.evaluate(() => (window as any).switchErrors)).toEqual(['连接暂不可用，请重试']);
  await page.locator('.cxx-shell-switch button').first().click();
  await page.getByText('源·派生', { exact: true }).last().click();
  await expect.poll(() => page.evaluate(() => (window as any).switchCalls.length)).toBe(2);
  await page.locator('.cxx-shell-switch button').first().click();
  await page.getByText('部署流', { exact: true }).last().click();
  await expect.poll(() => page.evaluate(() => (window as any).switchCalls)).toEqual(['source-derived', 'source-derived', 'deploy-flow']);
  await page.evaluate(() => {
    (window as any).switchFailures[1](Error('过时的打开错误'));
    (window as any).switchFinishes[2]();
  });
  await expect(page.locator('.cxx-shell-opening-main')).toBeHidden();
  await expect(page.getByRole('textbox', { name: '保留的草稿' })).toHaveValue('未保存内容');
  expect(await page.evaluate(() => (window as any).switchErrors)).toEqual(['连接暂不可用，请重试']);
  await page.evaluate(() => (window as any).shell.destroy());
  expect(await page.pageErrors()).toEqual([]);
});
