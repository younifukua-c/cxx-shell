import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const helper = new URL('../scripts/test-browser-cleanup.mjs', import.meta.url).href;

test('浏览器成功清理后不保留期限定时器', () => {
  const script = `import { closeTestBrowser } from ${JSON.stringify(helper)};
    await closeTestBrowser({ process: () => ({ stdio: [], unref() {} }), kill: async () => {} }, { timeoutMs: 60000 });`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    timeout: 5000,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
});

test('浏览器协议退出卡住时回收独占进程并报告失败', () => {
  const script = `import { spawn } from 'node:child_process';
    import { closeTestBrowser } from ${JSON.stringify(helper)};
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 60000)']);
    try { await closeTestBrowser({ process: () => child, kill: () => new Promise(() => {}) }, { timeoutMs: 100 }); }
    catch (error) { console.error(error.message); process.exitCode = 9; }`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    timeout: 5000,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 9, result.stderr);
  assert.match(result.stderr, /浏览器清理超过/);
});


test('优先正常关闭浏览器，释放大型套件的上下文与临时资料', () => {
  const script = `import { closeTestBrowser } from ${JSON.stringify(helper)};
    await closeTestBrowser({ process: () => ({ stdio: [], unref() {} }),
      close: async () => {}, kill: async () => { throw Error('不应跳过正常关闭'); } });`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    timeout: 5000, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
});


test('协议关闭卡住但 Playwright 确认强制回收时保留测试结果', () => {
  const script = `import { spawn } from 'node:child_process';
    import { once } from 'node:events';
    import { closeTestBrowser } from ${JSON.stringify(helper)};
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 60000)'], { windowsHide: true });
    await once(child, 'spawn');
    await closeTestBrowser({
      process: () => child,
      close: () => new Promise(() => {}),
      kill: async () => {
        const exited = once(child, 'exit');
        child.kill();
        await exited;
      },
    }, { timeoutMs: 100 });
    if (child.exitCode === null && child.signalCode === null) throw Error('独占进程还在运行');`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    timeout: 5000, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /已回收/);
});

test('浏览器进程已经退出时，协议连接悬挂不应使已完成的测试失败', () => {
  const script = `import { spawn } from 'node:child_process';
    import { once } from 'node:events';
    import { closeTestBrowser } from ${JSON.stringify(helper)};
    const child = spawn(process.execPath, ['-e', ''], { windowsHide: true });
    await once(child, 'exit');
    await closeTestBrowser({
      process: () => child,
      close: () => new Promise(() => {}),
      kill: async () => { throw Error('浏览器进程已经退出'); },
    }, { timeoutMs: 100 });`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    timeout: 5000, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
});


test('临时套件显式回收独占浏览器，不发出会话保存退出请求', () => {
  const script = `import { spawn } from 'node:child_process';
    import { once } from 'node:events';
    import { closeTestBrowser } from ${JSON.stringify(helper)};
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 60000)'], { windowsHide: true });
    await once(child, 'spawn');
    const exited = once(child, 'exit');
    await closeTestBrowser({
      process: () => child,
      close: async () => { throw Error('临时浏览器不需要保存会话'); },
      kill: async () => { child.kill(); await exited; },
    }, { force: true });
    if (child.exitCode === null && child.signalCode === null) throw Error('独占进程还在运行');`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    timeout: 5000, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
});

test('浏览器子进程已结束但清理承诺悬挂时正常收尾', () => {
  const script = `import {spawn} from 'node:child_process';
    import {once} from 'node:events';
    import {closeTestBrowser} from ${JSON.stringify(helper)};
    const child=spawn(process.execPath,['-e','setInterval(()=>{},60000)'],{windowsHide:true});
    await once(child,'spawn');
    await closeTestBrowser({process:()=>child,kill:()=>{child.kill();return new Promise(()=>{});}},
      {force:true,timeoutMs:500});
    if(child.exitCode===null&&child.signalCode===null)throw Error('浏览器进程仍在');
    if(child.listenerCount('exit'))throw Error('残留退出监听');`;
  const result=spawnSync(process.execPath,['--input-type=module','-e',script],{
    timeout:5000,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']});
  assert.equal(result.error,undefined);
  assert.equal(result.status,0,result.stderr);
});
