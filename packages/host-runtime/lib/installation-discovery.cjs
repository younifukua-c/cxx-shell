'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {canonical,readJson,failure}=require('./files.cjs');
const {inspectApplication}=require('./local-application.cjs');
const MAX_DIRECTORIES=200;
const METADATA=['cxx-application.json','manifest.json','package.json','build-info.json','resources/app.asar/package.json','resources/app/package.json'];

/** 元数据读取限制体积，不执行目录中的代码。 */
async function metadata(file) {
    let stat;try{stat=await fs.promises.lstat(file);}catch(error){if(['ENOENT','ENOTDIR'].includes(error.code))return null;throw error;}
    if(!stat.isFile()||stat.isSymbolicLink()||stat.size>1024*1024)return null;
    return readJson(file,null);
}

/** 扫描显式选择的目录及直接子目录，不全盘扫描或自动启用发现的程序。 */
async function discoverInstallations(directory) {
    const root=canonical(directory),entries=await fs.promises.readdir(root,{withFileTypes:true});
    const children=entries.filter(entry=>entry.isDirectory()&&!entry.isSymbolicLink()&&!entry.name.startsWith('.')&&entry.name!=='node_modules');
    if(children.length>MAX_DIRECTORIES) throw failure('INSTALL_SCAN_LIMIT','所选目录包含过多子目录，请缩小扫描范围');
    const candidates=[root,...children.map(entry=>path.join(root,entry.name))],batches=new Array(candidates.length);let next=0;
    await Promise.all(Array.from({length:Math.min(4,candidates.length)},async()=>{
        while(next<candidates.length) {
            const index=next++,candidate=candidates[index],found=[];
            const indexFile=await metadata(path.join(candidate,'installations.json'));
            if(indexFile?.schemaVersion===1&&indexFile.applications) {
                const applications=Object.entries(indexFile.applications);
                if(applications.length>MAX_DIRECTORIES)throw failure('INSTALL_SCAN_LIMIT','托管应用目录超过扫描上限');
                for(const [id,record] of applications)if(/^[a-z][a-z0-9-]{0,63}$/.test(id)&&['slot-a','slot-b'].includes(record.active))found.push({id,name:id,version:record.version,directory:path.join(candidate,id==='runtime'?'infrastructure':'apps',id,record.active,'payload'),registered:false});
            }
            for(const name of METADATA) {
                // Electron 对不存在的 ASAR 内部路径也可能报压缩包损坏，先确认包本体存在。
                if(name.startsWith('resources/app.asar/')&&!fs.existsSync(path.join(candidate,'resources','app.asar')))continue;
                const manifest=await metadata(path.join(candidate,name));if(!manifest)continue;
                const declaration=manifest.cxxApplication||manifest;
                const id=declaration.id||manifest.id||manifest.name||manifest.productName;
                if(!id||!(declaration.version||manifest.version)||!(declaration.entry||manifest.main||manifest.entry||manifest.application||manifest.buildId))continue;
                const unpacked=path.join(candidate,'win-unpacked');
                const directory=manifest.buildId&&fs.existsSync(unpacked)?unpacked:candidate;
                found.push({id,name:declaration.name||manifest.displayName||id,version:declaration.version||manifest.version,directory,registered:false});break;
            }
            batches[index]=found;
        }
    }));
    return [...new Map(batches.flat().map(entry=>[entry.id+':'+entry.directory,entry])).values()].map(entry=>{
        try {const module=inspectApplication(entry.directory);return {...entry,id:module.id,name:module.name,version:module.version,canAdd:true};}
        catch(error){return {...entry,canAdd:false,unavailableReason:error.message};}
    });
}
module.exports={discoverInstallations,inspectApplication};
