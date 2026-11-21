'use strict';
const path=require('node:path');
const os=require('node:os');
const {randomUUID}=require('node:crypto');
const {inventory}=require('./migration-files.cjs');
const {failure}=require('./files.cjs');

/** 为已受信任的程序来源生成内容清单；此函数本身不授予来源信任。 */
async function snapshotPackage({source,id,version,entry,fileSystem,exclude=[]}) {
    const target=path.join(os.tmpdir(),'cxx-package-snapshot-'+randomUUID());
    const files=await inventory([{source,destination:'payload'}],target,fileSystem,exclude);
    const manifest={id,version,entry,files:files.map(file=>({path:path.relative(source,file.source).split(path.sep).join('/'),sha256:file.digest}))};
    if(!manifest.files.some(file=>file.path===entry))throw failure('PACKAGE_ENTRY_INVALID','当前程序入口不在受信任目录中');
    return manifest;
}
module.exports={snapshotPackage};
