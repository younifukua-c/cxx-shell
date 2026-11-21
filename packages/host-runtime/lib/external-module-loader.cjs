'use strict';
const path=require('node:path');

/** 只收集公开入口实际加载且位于所属程序目录内的 CommonJS 模块。 */
function ownedModules(entry,root) {
    const result=new Set(),pending=entry?[entry]:[];
    while(pending.length) {
        const current=pending.pop();if(result.has(current))continue;
        const relative=path.relative(root,current.filename);
        if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))continue;
        result.add(current);pending.push(...current.children);
    }
    return result;
}

/** 资源释放后清除该应用的代码缓存；公共依赖及其他活动应用仍保留原引用。 */
function createExternalModuleLoader() {
    const loaded=new Map();
    return {
        load(record) {
            const exported=require(record.entry);
            loaded.set(record.id,{entry:require.cache[require.resolve(record.entry)],root:record.root});
            return exported;
        },
        release(id) {
            const current=loaded.get(id);if(!current)return;loaded.delete(id);
            const protectedModules=new Set();
            for(const other of loaded.values())for(const item of ownedModules(other.entry,other.root))protectedModules.add(item);
            for(const item of ownedModules(current.entry,current.root)) {
                if(protectedModules.has(item))continue;
                if(require.cache[item.filename]===item)delete require.cache[item.filename];
                if(item.parent)item.parent.children=item.parent.children.filter(child=>child!==item);
            }
        },
    };
}
module.exports={createExternalModuleLoader};
