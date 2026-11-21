'use strict';
const {failure}=require('./files.cjs');

/** 应用中心只消费目录端口，资格和版本来源可由远程 Provider 替换。 */
function createApplicationCenter({catalog,installed,enabled,isCompatible}) {
    return {
        async list() {
            const items=await catalog.list();
            if(!Array.isArray(items)||items.length>200) throw failure('CATALOG_LIMIT','应用目录响应超过上限');
            const seen=new Set();
            return items.map(item=>{
                if(!item.id||seen.has(item.id)) throw failure('CATALOG_DUPLICATE','应用目录包含重复标识');seen.add(item.id);
                return {...item,installedVersion:installed[item.id]?.version||null,enabled:enabled.has(item.id)};
            });
        },
        async plan(selected) {
            if(selected!==undefined&&(!Array.isArray(selected)||selected.length>200||selected.some(id=>typeof id!=='string')))throw failure('UPDATE_SELECTION_INVALID','升级选择必须是有界的应用标识列表');
            const items=await this.list();
            const ids=new Set(selected||items.filter(item=>item.installedVersion&&item.enabled).map(item=>item.id));
            const runtime=items.find(item=>item.id==='runtime'&&item.installedVersion!==item.version);
            if(runtime) ids.add('runtime');
            const known=new Map(items.map(item=>[item.id,item]));
            for(const id of ids) if(!known.has(id)) throw failure('APPLICATION_UNKNOWN','所选应用不在目录中');
            const blocked=runtime?items.filter(item=>item.installedVersion&&!ids.has(item.id)&&!isCompatible(item,runtime.version)):[];
            return {selected:[...ids],items:items.filter(item=>ids.has(item.id)),blocked:blocked.map(item=>({id:item.id,reason:'旧版本与新内核不兼容，请一起更新、卸载或暂缓升级'})),restartRequired:!!runtime};
        },
    };
}
module.exports={createApplicationCenter};
