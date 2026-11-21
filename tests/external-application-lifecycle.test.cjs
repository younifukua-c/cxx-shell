'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createApplicationModules}=require('@cxx/host-runtime/application-modules');
const {createExternalApplications}=require('@cxx/host-runtime/application-loader');

function fixture(t) {
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'external-lifecycle-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
    const entry=path.join(root,'entry.cjs'),preload=path.join(root,'preload.cjs');fs.writeFileSync(preload,'');
    fs.writeFileSync(entry,`const stats={aborted:0,disposed:0,loaded:0};let started;exports.started=new Promise(resolve=>started=resolve);exports.stats=stats;
        exports.createApplication=async({signal})=>{started();await new Promise(resolve=>signal?.addEventListener('abort',()=>{stats.aborted++;resolve();},{once:true}));return {load:async()=>{stats.loaded++;},dispose:async()=>{stats.disposed++;}};};`);
    const environment={id:'test',owner:'test-account',mode:'test',root:path.join(root,'data')};
    createApplicationModules(environment).register({id:'example',name:'Example',version:'1.0.0',root,entry:'entry.cjs',preload:'preload.cjs'});
    const external=createExternalApplications({runtime:{environment},electron:{},report:error=>assert.fail(error)});
    return {external,implementation:require(entry),view:{webContents:{isDestroyed:()=>false}}};
}

test('外部应用清理通过公开接口汇报实际进度，无需加载应用视图', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'external-cleanup-progress-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.writeFileSync(path.join(root, 'preload.cjs'), '');
    fs.writeFileSync(path.join(root, 'entry.cjs'), `exports.createApplication=()=>{throw Error('不应加载视图');};
        exports.cleanupProject=async({onProgress})=>{onProgress(2,5);onProgress(5,5);return {success:true};};`);
    const environment = { id: 'cleanup', owner: 'test-account', mode: 'test', root: path.join(root, 'data') };
    createApplicationModules(environment).register({ id: 'example', name: 'Example', version: '1.0.0', root, entry: 'entry.cjs', preload: 'preload.cjs' });
    const external = createExternalApplications({ runtime: { environment }, electron: {} });
    const progress = [];
    try {
        await external.cleanupProject('example', { id: 'project' }, 'task', new AbortController().signal,
            (completed, total) => progress.push([completed, total]));
        assert.deepEqual(progress, [[2, 5], [5, 5]]);
    } finally { await external.destroy(); }
});
test('宿主退出会取消初始化中的应用，等待其释放，不遗留迟到实例',async t=>{
    const f=fixture(t),loading=f.external.descriptor('example').load(f.view).catch(error=>error);
    await f.implementation.started;await f.external.destroy();
    assert.equal(f.implementation.stats.aborted,1);assert.equal(f.implementation.stats.loaded,0);assert.equal(f.implementation.stats.disposed,1);
    assert.equal((await loading).code,'APPLICATION_CLOSED');
});
test('关闭尚未加载完成的应用也会通知取消，并等待资源释放',async t=>{
    const f=fixture(t),loading=f.external.descriptor('example').load(f.view).catch(error=>error);
    await f.implementation.started;await f.external.closed('example');await f.external.waitClosed();
    assert.equal(f.implementation.stats.aborted,1);assert.equal(f.implementation.stats.disposed,1);assert.equal((await loading).code,'APPLICATION_CLOSED');
});

test('应用关闭释放失败后保留重试出口，等待关闭会恢复且不重复释放成功实例',async t=>{
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'external-close-retry-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
    const entry=path.join(root,'entry.cjs');fs.writeFileSync(path.join(root,'preload.cjs'),'');
    fs.writeFileSync(entry,`exports.stats={calls:0,available:false};exports.createApplication=async()=>({load:async()=>{},dispose:async()=>{exports.stats.calls++;if(!exports.stats.available)throw Object.assign(Error('恢复后重试'),{code:'ENVIRONMENT_LEASE_MISSING'});}});`);
    const environment={id:'retry',owner:'test-account',mode:'test',root:path.join(root,'data')};
    createApplicationModules(environment).register({id:'example',name:'Example',version:'1.0.0',root,entry:'entry.cjs',preload:'preload.cjs'});
    const external=createExternalApplications({runtime:{environment},electron:{}}),implementation=require(entry);
    const view={webContents:{isDestroyed:()=>false}};await external.descriptor('example').load(view);
    await assert.rejects(external.closed('example'),{code:'ENVIRONMENT_LEASE_MISSING'});
    implementation.stats.available=true;await external.waitClosed();await external.closed('example');
    assert.equal(implementation.stats.calls,2);await external.destroy();
});

for(const failLoad of [false,true])test(`环境租约释放失败可重试且不重复释放业务：${failLoad?'初始化失败':'正常关闭'}`,async t=>{
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'external-lease-retry-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
    const payload=path.join(root,'payload');fs.mkdirSync(payload);fs.writeFileSync(path.join(payload,'engine.txt'),'private engine');
    const requirement={technology:'java',compatibility:'26',platform:process.platform,arch:process.arch};
    const {snapshotPackage}=require('@cxx/host-runtime/package-snapshot');
    const manifest=await snapshotPackage({source:payload,id:'java-26-'+process.platform+'-'+process.arch,version:'26.0.1',entry:'engine.txt'});
    fs.writeFileSync(path.join(root,'runtime-packages.json'),JSON.stringify({schemaVersion:1,packages:[{requirement,source:'payload',manifest}]}));
    const entry=path.join(root,'entry.cjs');fs.writeFileSync(path.join(root,'preload.cjs'),'');
    fs.writeFileSync(entry,`exports.stats={closed:0};exports.createApplication=async({runtimes})=>{await runtimes.acquire(${JSON.stringify(requirement)});return{load:async()=>{exports.stats.onLoad?.();},dispose:async()=>{exports.stats.closed++;}};};`);
    const environment={id:'retry',owner:'test-account',mode:'test',root:path.join(root,'data')};
    createApplicationModules(environment).register({id:'example',name:'Example',version:'1.0.0',root,entry:'entry.cjs',preload:'preload.cjs',runtimePackages:'runtime-packages.json'});
    const installed=path.join(root,'installation');let active=installed;
    const external=createExternalApplications({runtime:{environment},electron:{},installationRoot:()=>installed,activeInstallationRoot:()=>active});
    const implementation=require(entry),load=()=>external.descriptor('example').load({webContents:{isDestroyed:()=>false}});
    if(failLoad){implementation.stats.onLoad=()=>{active=path.join(root,'missing');throw Error('加载失败');};await assert.rejects(load(),{code:'ENVIRONMENT_LEASE_MISSING'});}
    else{await load();active=path.join(root,'missing');await assert.rejects(external.closed('example'),{code:'ENVIRONMENT_LEASE_MISSING'});}
    active=installed;await external.waitClosed();assert.equal(implementation.stats.closed,1);
    const {createRuntimeEnvironments}=require('@cxx/host-runtime/runtime-environments');
    assert.equal(createRuntimeEnvironments({root:installed,owner:environment.owner}).leases().length,0);await external.destroy();
});
