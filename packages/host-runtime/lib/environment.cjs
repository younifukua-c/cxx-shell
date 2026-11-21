'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { canonical, failure, readJson, initializeJson } = require('./files.cjs');

/** 解析显式测试入口，自动化测试必须由调用方注入独立目录。 */
function launchOptions(args, env = process.env) {
    const read = flag => {
        const entries = args.filter(value => value === flag || value.startsWith(flag + '='));
        if (entries.length > 1) throw failure('LAUNCH_OPTION_DUPLICATE', `启动参数重复：${flag}`);
        const index = args.indexOf(flag);
        const value = entries[0]?.startsWith(flag + '=') ? entries[0].slice(flag.length + 1) : index >= 0 ? args[index + 1] : '';
        if (entries.length && (!value || value.startsWith('--'))) throw failure('LAUNCH_OPTION_REQUIRED', `请指定 ${flag} 的目录`);
        return value;
    };
    const testRoot = read('--test-root') || env.CXX_TEST_ROOT || '';
    const explicitTestData=read('--test-user-data');
    if(testRoot&&explicitTestData) throw failure('LAUNCH_OPTIONS_CONFLICT','测试根目录和旧测试目录只能选择一种');
    const automated = env.PLAYWRIGHT_TEST === '1' || env.NODE_ENV === 'test';
    const isolatedUserData = explicitTestData || env.CXX_REPODOCK_USER_DATA || env.WORKDISK_USER_DATA || '';
    if (automated && !testRoot && !isolatedUserData) throw failure('TEST_DIRECTORY_REQUIRED', '自动化测试必须指定独立数据目录');
    const mode = testRoot || automated || isolatedUserData ? 'test' : 'production';
    return { mode, automated, root: testRoot ? canonical(path.resolve(testRoot)) : '', isolatedUserData };
}

/** 从账户定位文件发现已有正式环境；初次仅登记旧数据，不移动内容。 */
function resolveEnvironment({ options, locatorFile, defaultRoot, legacy, codeSource, userId }) {
    const locator = options.mode === 'production' ? readJson(locatorFile, null) : null;
    if (locator && (!locator.environmentId || !path.isAbsolute(locator.dataRoot))) throw failure('LOCATOR_INVALID', '环境定位记录损坏，请选择原数据目录恢复');
    let root = canonical(locator?.dataRoot || options.root || options.isolatedUserData || defaultRoot);
    let markerFile = path.join(root, 'environment.json');
    let marker = readJson(markerFile, null);
    const visited=new Set();
    while(marker?.redirectRoot) {
        if(visited.has(root)||visited.size>=5) throw failure('ENVIRONMENT_REDIRECT_INVALID','环境目录迁移记录形成循环');
        visited.add(root);
        const previous=marker;
        root=canonical(marker.redirectRoot);markerFile=path.join(root,'environment.json');marker=readJson(markerFile,null);
        if(!marker||marker.id!==previous.id||marker.owner!==previous.owner||marker.mode!==previous.mode) throw failure('ENVIRONMENT_REDIRECT_INVALID','迁移后的目录身份无法验证');
    }
    if (locator && !marker) throw failure('DATA_DIRECTORY_MISSING', '原数据目录无法识别，请恢复连接或选择原目录，未创建空数据');
    if (marker && (marker.schemaVersion !== 1 || !/^[0-9a-f-]{36}$/.test(marker.id) || marker.mode !== options.mode)) throw failure('ENVIRONMENT_MISMATCH', '该目录不属于当前运行环境');
    if (marker?.owner !== userId) {
        if (marker) throw failure('ENVIRONMENT_OWNER_MISMATCH', '数据目录属于其他系统账户');
    }
    if (locator && marker.id !== locator.environmentId) throw failure('ENVIRONMENT_ID_MISMATCH', '数据目录与正式环境记录不一致');
    if (!marker) {
        fs.mkdirSync(root, { recursive:true });
        const existing = fs.readdirSync(root).filter(name => name !== 'environment.json' && !/^\.cxx-bootstrap-[0-9a-f-]+\.tmp(?:\.[0-9a-f-]+\.tmp)?$/.test(name));
        marker=readJson(markerFile,null);
        if (!marker && existing.length && !options.isolatedUserData) throw failure('DIRECTORY_NOT_EMPTY', '新环境目录已有内容，请选择空目录或恢复已有环境');
        marker ||= initializeJson(markerFile, { schemaVersion:1, id:randomUUID(), mode:options.mode, owner:userId,
            layout:legacy ? 'legacy' : 'categorized', legacy:legacy || undefined });
        if(marker.mode!==options.mode || marker.owner!==userId) throw failure('ENVIRONMENT_MISMATCH','该目录已被其他环境登记');
    }
    const result = { ...marker, root, codeSource:canonical(codeSource), locatorFile:options.mode==='production' ? locatorFile : '', automated:options.automated };
    if (result.locatorFile && !locator) {
        const winner=initializeJson(locatorFile, { schemaVersion:1, environmentId:marker.id, dataRoot:root });
        if(winner.environmentId!==marker.id || canonical(winner.dataRoot)!==root) return resolveEnvironment({options,locatorFile,defaultRoot,legacy,codeSource,userId});
    }
    return result;
}

/** 按账户与环境分配内核地址，与工作盘盘符无关。 */
function kernelAddress(environment, platform = process.platform) {
    const id = createHash('sha256').update(`${environment.owner}:${environment.id}`).digest('hex').slice(0,32);
    return platform === 'win32' ? `\\\\.\\pipe\\cxx-runtime-${id}` : path.join(environment.root, 'runtime', `kernel-${id}.sock`);
}
/** 用户明确选择原资料后恢复定位；只改指针，旧记录先保留副本。 */
function restoreEnvironmentLocation({locatorFile,directory,userId}) {
    const root=canonical(directory),marker=readJson(path.join(root,'environment.json'),null);
    if(!marker||marker.schemaVersion!==1||!/^([0-9a-f-]{36})$/.test(marker.id)||marker.mode!=='production'||marker.owner!==userId||marker.redirectRoot)
        throw failure('ENVIRONMENT_RECOVERY_INVALID','请选择本账户正在使用、包含 environment.json 的实际数据目录');
    let previous=null;
    try {previous=readJson(locatorFile,null);}catch(error){if(error.code!=='DOCUMENT_UNREADABLE')throw error;}
    if(previous?.environmentId&&previous.environmentId!==marker.id)throw failure('ENVIRONMENT_ID_MISMATCH','此目录属于另一份环境，原定位记录已保留，请选择对应目录');
    let backup=null;
    if(fs.existsSync(locatorFile)) {backup=locatorFile+'.recovery-'+randomUUID()+'.json';fs.copyFileSync(locatorFile,backup,fs.constants.COPYFILE_EXCL);}
    require('./files.cjs').writeJson(locatorFile,{schemaVersion:1,environmentId:marker.id,dataRoot:root});
    return {dataRoot:root,environmentId:marker.id,backup};
}
module.exports = { launchOptions, resolveEnvironment, kernelAddress,restoreEnvironmentLocation };
