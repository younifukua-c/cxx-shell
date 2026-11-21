'use strict';
const path=require('node:path');
const {canonical,inside,readJson,writeJson,failure}=require('./files.cjs');
const {createInstallations}=require('./installations.cjs');
const {environmentLeases}=require('./runtime-environment-files.cjs');

/** 单个安装位置的环境依赖与占用登记；调用方在该位置的排他锁内提交修改。 */
function createEnvironmentRecords(root,{owner,provider,onProgress}) {
    const directory=canonical(root),maintenance=inside(directory,path.join(directory,'infrastructure','environments'));
    const bindingFile=inside(maintenance,path.join(maintenance,'applications.json'));
    const leaseFile=inside(maintenance,path.join(maintenance,'leases.json'));
    const leases=()=>environmentLeases(maintenance);
    return {
        directory,maintenance,leases,
        installations:()=>createInstallations({root:directory,owner,scope:'environment',leases,
            verify:async manifest=>await provider.verify?.(manifest)===true,onProgress}),
        bindings() {
            const value=readJson(bindingFile,[]);
            if(!Array.isArray(value)||value.length>4096||value.some(user=>!user||!Array.isArray(user.environments)||user.environments.length>16))
                throw failure('ENVIRONMENT_BINDING_INVALID','应用依赖登记无法确认，运行环境已保留');
            return value;
        },
        saveBindings:value=>writeJson(bindingFile,value),
        saveLeases:value=>writeJson(leaseFile,value),
        slotPath:(key,slot)=>inside(maintenance,path.join(maintenance,key,slot)),
    };
}
module.exports={createEnvironmentRecords};
