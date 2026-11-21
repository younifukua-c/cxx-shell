'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {canonical,inside,failure}=require('./files.cjs');

/** 文件摘要用于拒绝登记后被改写的本地入口；远程发布仍必须核验发布者签名。 */
function fingerprint(file) {return createHash('sha256').update(fs.readFileSync(file)).digest('hex');}

/** 清单和已登记模块共用归属与入口检查，不加载应用代码。 */
function validateApplicationModule(record) {
    if(!/^[a-z][a-z0-9-]{0,63}$/.test(record?.id||'')||typeof record.name!=='string'||!record.name||record.name.length>128||!/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(record.version||''))throw failure('MODULE_DEFINITION_INVALID','应用模块定义无效');
    const root=canonical(record.root);
    if(typeof record.entry!=='string'||typeof record.preload!=='string')throw failure('MODULE_ENTRY_INVALID','此软件没有提供可加入的应用入口');
    const entry=inside(root,path.resolve(root,record.entry)),preload=inside(root,path.resolve(root,record.preload));
    for(const file of [entry,preload])if(!['.cjs','.js'].includes(path.extname(file))||!fs.statSync(file).isFile())throw failure('MODULE_ENTRY_INVALID','应用入口或预加载文件不可用，请先完成该软件的安装或构建');
    const runtimePackages=record.runtimePackages===undefined?undefined:path.relative(root,inside(root,path.resolve(root,record.runtimePackages)));
    if(runtimePackages){const stat=fs.statSync(path.join(root,runtimePackages));if(!stat.isFile()||stat.size>1024*1024)throw failure('MODULE_RUNTIME_INVALID','应用运行环境分发清单尚未构建或超出大小限制');}
    return {id:record.id,name:record.name,version:record.version,root,entry:path.relative(root,entry),preload:path.relative(root,preload),...(runtimePackages?{runtimePackages}:{})};
}

/** 一次核对同时绑定入口、预加载与运行环境声明。 */
function snapshot(record) {
    return {...record,entryDigest:fingerprint(path.join(record.root,record.entry)),preloadDigest:fingerprint(path.join(record.root,record.preload)),
        ...(record.runtimePackages?{runtimePackagesDigest:fingerprint(path.join(record.root,record.runtimePackages))}:{})};
}
module.exports={fingerprint,validateApplicationModule,snapshot};
