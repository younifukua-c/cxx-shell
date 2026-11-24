'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {isDeepStrictEqual}=require('node:util');
const {createStorage}=require('./storage.cjs');
const {canonical,readJson,writeJson,failure}=require('./files.cjs');
const {fingerprint,validateApplicationModule,snapshot}=require('./application-module-definition.cjs');
const {inspectApplication}=require('./local-application.cjs');
const {applicationBranding,presentApplication}=require('./application-branding.cjs');
const MAX_MODULES=64;
/** 本账户明确启动登记的产品模块。模块定义只有这一份，不复制进各产品目录。 */
function createApplicationModules(environment) {
    const storage=createStorage(environment),directory=storage.file('settings','common','host-runtime','modules');
    const key=id=>{if(!/^[a-z][a-z0-9-]{0,63}$/.test(id||''))throw failure('MODULE_DEFINITION_INVALID','应用标识无效');return storage.file('settings','common','host-runtime',path.join('modules',id+'.json'));};
    const read=id=>{
        const value=readJson(key(id),null);if(!value)return null;
        if(value.schemaVersion!==1||value.owner!==environment.owner||value.environmentId!==environment.id||value.module?.id!==id)throw failure('MODULE_REGISTRY_INVALID','应用模块登记无法核对，原资料已保留');
        const record=value.module;
        // 单一兼容入口为旧登记补展示元数据，不改 ID、不写回或搬动资料。
        return record.productCode ? record : {...record,...applicationBranding(record.root,record.id)};
    };
    const list=()=>{
        if(!fs.existsSync(directory))return [];
        const names=fs.readdirSync(directory).filter(name=>/^[a-z][a-z0-9-]{0,63}\.json$/.test(name)).sort();
        if(names.length>MAX_MODULES)throw failure('MODULE_LIMIT','应用模块数量超过上限');
        return names.map(name=>{const record=read(name.slice(0,-5));return {...presentApplication(record),external:true,infrastructure:false,demo:false};});
    };
    const persist=record=>writeJson(key(record.id),{schemaVersion:1,owner:environment.owner,environmentId:environment.id,module:record});
    const registered=id=>{const record=read(id);if(!record)throw failure('MODULE_NOT_REGISTERED','此应用尚未登记，请从其正式入口启动一次');return record;};
    /** 核对原位置的当前公开声明，不加载应用或修改登记。 */
    function currentSnapshot(previous) {
        const definition=inspectApplication(previous.root);
        if(definition.id!==previous.id||definition.root!==previous.root)throw failure('MODULE_IDENTITY_CHANGED','原位置已变成其他应用或被重定向，请重新查找并核对安装位置');
        return snapshot(definition);
    }
    /** 只从原登记位置重新读取声明，确认令牌同时绑定原登记与新内容。 */
    function candidate(id) {
        const previous=registered(id),next=currentSnapshot(previous);
        const token=createHash('sha256').update(JSON.stringify({previous,next})).digest('hex');
        return {previous,next,token};
    }
    return {
        register(input) {
            const record=validateApplicationModule(input),existing=read(record.id);
            if(!existing&&list().length>=MAX_MODULES)throw failure('MODULE_LIMIT','应用模块数量超过上限');
            const next=snapshot(record);persist(next);return next;
        },
        list,
        review(id) {
            const {previous,next,token}=candidate(id);
            return {id:next.id,name:next.name,previousVersion:previous.version,version:next.version,root:next.root,token};
        },
        refresh(id,token) {
            if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))throw failure('MODULE_REVIEW_INVALID','请先核对应用更新');
            const current=candidate(id);
            if(token!==current.token)throw failure('MODULE_REVIEW_EXPIRED','核对期间程序再次发生变化，请重新打开并核对更新');
            persist(current.next);return current.next;
        },
        unregister(id){const file=key(id);if(fs.existsSync(file))fs.unlinkSync(file);},
        resolve(id) {
            const record=registered(id);
            if(canonical(record.root)!==record.root)throw failure('MODULE_IDENTITY_CHANGED','原安装位置已被重定向，请重新查找并核对安装位置');
            let current;
            try{current=currentSnapshot(record);}
            catch(error){if(error.code!=='APPLICATION_ENTRY_UNAVAILABLE')throw error;}
            if(current) {
                if(!isDeepStrictEqual(current,record))throw failure('MODULE_CHANGED','应用公开声明或程序内容已更新，请核对更新后再打开');
                return {...current,entry:path.join(current.root,current.entry),preload:path.join(current.root,current.preload)};
            }
            // 没有公开声明的旧式直接登记只核对原入口；无效声明不能进入此兼容分支。
            const valid={...record,...validateApplicationModule(record)};
            if(valid.root!==record.root)throw failure('MODULE_IDENTITY_CHANGED','原安装位置已被重定向，请重新查找并核对安装位置');
            if(fingerprint(path.join(valid.root,valid.entry))!==valid.entryDigest||fingerprint(path.join(valid.root,valid.preload))!==valid.preloadDigest)throw failure('MODULE_CHANGED','应用程序已更新，请核对更新后再打开');
            if(valid.runtimePackages&&fingerprint(path.join(valid.root,valid.runtimePackages))!==valid.runtimePackagesDigest)throw failure('MODULE_CHANGED','应用运行环境已更新，请核对更新后再打开');
            return {...valid,entry:path.join(valid.root,valid.entry),preload:path.join(valid.root,valid.preload)};
        },
    };
}
/** 已核对的基建启动入口；产品启动器只转交应用标识，不读取另一产品的私有代码。 */
function createHostLauncher(environment) {
    const file=createStorage(environment).file('settings','common','host-runtime','launcher.json');
    return {
        register({executable,args=[],directory,sourceId}) {
            if(!Array.isArray(args)||args.length>8||args.some(value=>typeof value!=='string'||value.length>4096))throw failure('HOST_ENTRY_INVALID','基建启动参数无效');
            const value={schemaVersion:1,owner:environment.owner,environmentId:environment.id,executable:canonical(executable),directory:canonical(directory),args,sourceId};
            writeJson(file,value);return value;
        },
        read() {
            const value=readJson(file,null);if(!value)return null;
            if(value.schemaVersion!==1||value.owner!==environment.owner||value.environmentId!==environment.id||!Array.isArray(value.args)||value.args.length>8||value.args.some(item=>typeof item!=='string'))throw failure('HOST_ENTRY_INVALID','公共基建入口登记无法核对，请重新启动基建程序');
            if(!fs.existsSync(value.executable)||!fs.existsSync(value.directory))throw failure('HOST_ENTRY_MISSING','公共基建程序暂不可用，请修复安装位置，已有数据已保留');
            return value;
        },
    };
}
module.exports={createApplicationModules,createHostLauncher,validateApplicationModule};
