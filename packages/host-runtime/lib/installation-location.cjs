'use strict';
const path=require('node:path');
const {readJson,canonical,failure}=require('./files.cjs');
const {createMigration}=require('./migration.cjs');

/** 托管程序迁移复用复制协议；切换后保留仍在使用的旧槽，退出后清理。 */
function createInstallationLocation({root,journalFile,leases=()=>[],barrier,activate,activeRoot=()=>root,onChange,fileSystem}) {
    const saved=readJson(journalFile,null);
    const original=['switching','cleanup-pending','recovery-required'].includes(saved?.phase)&&saved.sourceRoots?.[0]
        ?path.dirname(saved.sourceRoots[0]):canonical(root);
    const migration=createMigration({journalFile,barrier,activeRoot,onChange,fileSystem,
        canCleanup:file=>{
            const inUse=leases().find(lease=>lease.directory&&(file===lease.directory||file.startsWith(lease.directory+path.sep)));
            return inUse?{directory:inUse.directory}:true;
        },
        mappings:['installations.json','environments.json','apps','infrastructure'].map(name=>({source:path.join(original,name),destination:name})),
        activate});
    return {...migration,
        async prepare(target) {
            const manifest=readJson(path.join(original,'installations.json'),null)||readJson(path.join(original,'environments.json'),null);
            if(!manifest||manifest.schemaVersion!==1||!manifest.id)throw failure('INSTALL_ROOT_UNREGISTERED','此位置还没有托管程序，无需迁移；可以直接选择新的空安装目录');
            return migration.prepare(target);
        },
        async switch() {return migration.switch();},
    };
}
module.exports={createInstallationLocation};
