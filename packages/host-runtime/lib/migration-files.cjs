'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { canonical, inside, distinct, digest, failure } = require('./files.cjs');
const MAX_FILES = 100000;

/** 枚举明确归属的模块，拒绝链接、设备与无上限扫描。 */
async function inventory(mappings, targetRoot,fileSystem=fs,exclude=[]) {
    if(!Array.isArray(exclude)||exclude.length>32||exclude.some(name=>typeof name!=='string'||!name||name.includes('/')||name.includes('\\')||name==='..'))throw failure('PACKAGE_EXCLUSION_INVALID','程序排除项必须为有界的顶层文件名');
    const items=[]; const destinations=new Set();
    for(const mapping of mappings) {
        try {if((await fileSystem.promises.lstat(mapping.source)).isSymbolicLink()) throw failure('MIGRATION_LINK_UNSUPPORTED','源模块为链接，请先选择实际数据目录');}
        catch(error) {if(error.code!=='ENOENT') throw error;}
        const source=canonical(mapping.source);
        distinct(source,targetRoot);
        const visit=async(file,relative)=>{
            if(relative&&exclude.includes(relative.split(path.sep)[0]))return;
            let stat;
            try { stat=await fileSystem.promises.lstat(file); }
            catch(error) { if(error.code==='ENOENT'&&!relative) return; throw error; }
            if(stat.isSymbolicLink()) throw failure('MIGRATION_LINK_UNSUPPORTED', '迁移范围包含链接，请先选择实际数据目录');
            if(stat.isDirectory()) {
                const names=await fileSystem.promises.readdir(file);
                for(const name of names.sort()) await visit(path.join(file,name),path.join(relative,name));
                return;
            }
            if(!stat.isFile()) throw failure('MIGRATION_FILE_UNSUPPORTED','迁移范围包含非普通文件');
            if(items.length>=MAX_FILES) throw failure('MIGRATION_FILE_LIMIT','文件数超过迁移批次上限');
            const destination=inside(targetRoot,path.join(targetRoot,mapping.destination,relative));
            const key=process.platform==='win32'?destination.toLowerCase():destination;
            if(destinations.has(key)) throw failure('MIGRATION_DUPLICATE_TARGET','多个源文件指向同一目标');
            destinations.add(key);
            items.push({source:file,destination,size:stat.size,digest:await digest(file,fileSystem)});
        };
        await visit(source,'');
    }
    return items;
}

/** 写目标同目录临时副本，再按摘要确认后替换，不修改源。 */
async function copyVerified(item,fileSystem=fs) {
    await fileSystem.promises.mkdir(path.dirname(item.destination),{recursive:true});
    const pending=item.destination+'.'+randomUUID()+'.tmp';
    try {
        await fileSystem.promises.copyFile(item.source,pending);
        if(await digest(pending,fileSystem)!==item.digest) throw failure('MIGRATION_SOURCE_CHANGED','复制期间源文件发生变化，将重新同步');
        const handle=await fileSystem.promises.open(pending,'r+');
        try {await handle.sync();}finally {await handle.close();}
        await fileSystem.promises.rename(pending,item.destination);
    } finally { await fileSystem.promises.rm(pending,{force:true}); }
}

/** 仅清理经过校验的已迁移文件，后来修改或新增的源文件继续保留。 */
async function cleanupFiles(items, sourceRoots,canCleanup=()=>true,fileSystem=fs) {
    const failures=[];
    const protectedRoots=new Set();
    const directoryRoots=sourceRoots.filter(root=>{try{return fileSystem.lstatSync(root).isDirectory();}catch(error){if(error.code==='ENOENT')return false;throw error;}});
    for(const item of items) {
        try {
            const permission=canCleanup(item.source);
            if(permission!==true) {
                const protectedRoot=permission?.directory||item.source;
                if(!protectedRoots.has(protectedRoot))failures.push({path:protectedRoot,code:'CLEANUP_IN_USE',message:'程序仍在使用，退出并启用新位置后自动清理'});
                protectedRoots.add(protectedRoot);continue;
            }
            const root=sourceRoots.find(candidate=>{
                const relative=path.relative(candidate,item.source);
                return !relative || (!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));
            });
            if(!root) throw failure('CLEANUP_SCOPE_INVALID','源文件不在本次清理范围');
            if(!fileSystem.existsSync(item.source)) continue;
            const stat=await fileSystem.promises.lstat(item.source);
            if(!stat.isFile()||stat.isSymbolicLink()) throw failure('CLEANUP_SOURCE_CHANGED','源文件类型已变化');
            if(await digest(item.source,fileSystem)!==item.digest || await digest(item.destination,fileSystem)!==item.digest) throw failure('CLEANUP_SOURCE_CHANGED','副本内容已变化，保留旧文件');
            await fileSystem.promises.unlink(item.source);
        } catch(error) { failures.push({path:item.source,code:error.code||'CLEANUP_FAILED',message:error.message}); }
    }
    for(const root of directoryRoots) {
        const removeEmpty=async directory=>{
            if([...protectedRoots].some(root=>directory===root||directory.startsWith(root+path.sep)))return;
            try {
                const entries=await fileSystem.promises.readdir(directory,{withFileTypes:true});
                for(const entry of entries)if(entry.isDirectory()&&!entry.isSymbolicLink())await removeEmpty(inside(root,path.join(directory,entry.name)));
                await fileSystem.promises.rmdir(directory);
            }catch(error){if(error.code==='ENOENT')return;failures.push({path:directory,code:error.code||'CLEANUP_FAILED',message:error.code==='ENOTEMPTY'?'原目录仍有新增或变化的内容，已保留':error.message});}
        };
        await removeEmpty(root);
    }
    return failures;
}
module.exports = { inventory, copyVerified, cleanupFiles };
