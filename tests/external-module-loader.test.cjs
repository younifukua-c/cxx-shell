'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createExternalModuleLoader}=require('../packages/host-runtime/lib/external-module-loader.cjs');

test('释放应用只清理其所属代码，其他活动应用共用的模块在最后释放后清理',t=>{
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'module-cache-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
    const helper=path.join(root,'helper.cjs');fs.writeFileSync(helper,'module.exports={value:1}');
    for(const id of ['a','b'])fs.writeFileSync(path.join(root,id+'.cjs'),'module.exports=require("./helper.cjs")');
    const modules=createExternalModuleLoader();
    const a=modules.load({id:'a',root,entry:path.join(root,'a.cjs')}),b=modules.load({id:'b',root,entry:path.join(root,'b.cjs')});assert.equal(a,b);
    modules.release('a');assert.ok(require.cache[helper]);assert.equal(require.cache[path.join(root,'a.cjs')],undefined);
    modules.release('a');modules.release('missing');modules.release('b');assert.equal(require.cache[helper],undefined);
    fs.writeFileSync(helper,'module.exports={value:2}');assert.equal(modules.load({id:'a',root,entry:path.join(root,'a.cjs')}).value,2);modules.release('a');
});
