import { test, expect } from "@playwright/test";
for (const theme of ["dark", "light", "glass"])
  test("独立框架切换页面保留草稿并完整释放 · " + theme, async ({ page }) => {
    await page.goto("/");
    await page.evaluate(
      (theme) => (window as any).shell.setTheme(theme),
      theme,
    );
    const draft = page.getByRole("textbox", { name: "笔记草稿" });
    await draft.fill("保留未保存内容");
    await page.evaluate(() => (window as any).shell.selectApp("tasks"));
    await expect(page.getByRole("textbox", { name: "任务草稿" })).toBeVisible();
    await page.evaluate(() => (window as any).shell.selectApp("notes"));
    await expect(draft).toHaveValue("保留未保存内容");
    await page.evaluate(() => {
      (window as any).shell.destroy();
      (window as any).shell.destroy();
    });
    expect(await page.pageErrors()).toEqual([]);
  });
