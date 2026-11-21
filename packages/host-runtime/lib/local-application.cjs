'use strict';
const fs=require('node:fs'),path=require('node:path');
const {canonical,inside,readJson,failure}=require('./files.cjs');
const {validateApplicationModule}=require('./application-module-definition.cjs');
const MAX_MANIFEST_BYTES=1024*1024;

/** 仅读取有界声明；扫描与加入均不执行目标软件的初始化。 */
function manifest(root,name) {
    const file=inside(root,path.join(root,name));
    let info;try{info=fs.lstatSync(file);}catch(error){if(error.code==='ENOENT')return null;throw error;}
    if(!info.isFile()||info.isSymbolicLink()||info.size>MAX_MANIFEST_BYTES)throw failure('APPLICATION_MANIFEST_INVALID','应用声明不可读取，请检查安装是否完整');
    return readJson(file,null);
}

/** 优先使用显式声明；桌面宿主旧入口只在此处适配为同一模块定义。 */
function inspectApplication(directory) {
    const base=canonical(directory);
    for(const root of [base,path.join(base,'resources/app'),path.join(base,'resources/app.asar')]) {
        if(!fs.existsSync(root))continue;
        const pkg=manifest(root,'package.json');let definition=manifest(root,'cxx-application.json')||pkg?.cxxApplication;
        if(!definition&&pkg?.main==='desktop/main.cjs'&&pkg.dependencies?.['@cxx/host-runtime']) {
            definition={id:pkg.name?.replace(/^cxx-/,''),entry:'desktop/application.cjs',preload:'desktop/dist/host-preload.cjs'};
        }
        if(!definition)continue;
        if(definition.schemaVersion!==undefined&&definition.schemaVersion!==1)throw failure('APPLICATION_PROTOCOL_UNSUPPORTED','此应用声明版本尚不兼容，请先升级公共基建');
        try{return validateApplicationModule({...definition,name:definition.name||pkg?.productName||pkg?.name,version:definition.version||pkg?.version,root});}
        catch(error){if(['ENOENT','ENOTDIR'].includes(error.code))throw failure('APPLICATION_INCOMPLETE','缺少应用入口或预加载文件，请先完成该软件的安装或构建');throw error;}
    }
    throw failure('APPLICATION_ENTRY_UNAVAILABLE','此版本尚未提供公共应用入口，可先升级或从原软件启动一次');
}
module.exports={inspectApplication};
