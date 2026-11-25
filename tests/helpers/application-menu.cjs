const {expect}=require('@playwright/test');
const itemSelector='[role=option],[role=menuitemradio],[role=menuitem]';
/** 使用公共级联菜单第一列，避免把二级列或未展开空节点当作一级快照。 */
async function roots(page){
 const column=page.locator('.cxx-cascader-column:visible').first();await expect(column).toBeVisible();
 const labels=(await column.locator(itemSelector).allTextContents()).map(text=>text.trim());
 expect(labels.length).toBeGreaterThan(1);return labels;
}
async function choose(page,application,entry=application){
 await page.locator('.cxx-shell-switch button').first().click();
 const first=page.locator('.cxx-cascader-column:visible').first();await expect(first).toBeVisible();
 await first.getByText(application,{exact:true}).hover();
 const children=page.locator('.cxx-cascader-column:visible').nth(1);await expect(children).toBeVisible();
 await children.getByText(entry,{exact:true}).click();
}
async function branches(page){
 const result={};const first=page.locator('.cxx-cascader-column:visible').first();
 for(const name of ['源·派生','部署流']){
  await first.getByText(name,{exact:true}).hover();
  const second=page.locator('.cxx-cascader-column:visible').nth(1);await expect(second).toBeVisible();
  result[name]=(await second.locator(itemSelector).allTextContents()).map(text=>text.trim());
 }
 return result;
}
module.exports={roots,choose,branches};
