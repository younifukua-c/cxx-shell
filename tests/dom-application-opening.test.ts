import test from 'node:test';
import assert from 'node:assert/strict';
import {createDomApplicationOpening} from '../packages/app-shell/src/dom-application-opening';

function fixture() {
  const pending: {resolve(): void; reject(error: Error): void}[] = [];
  const calls: string[] = [], errors: unknown[] = [];
  const opening = createDomApplicationOpening({nameOf: id => id, showApplication() {},
    onOpen(id) {calls.push(id); return new Promise<void>((resolve,reject) => pending.push({resolve,reject}));},
    onError: error => errors.push(error)});
  return {opening, pending, calls, errors};
}
test('原生切换复用在途请求，失败可重试，销毁不发布迟到错误', async t => {
  const original=globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame=callback => {callback(0);return 1;};
  t.after(()=>{globalThis.requestAnimationFrame=original;});
  const f=fixture();
  const a=f.opening.open('source'), b=f.opening.open('source');
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(f.calls,['source']);
  f.pending[0].reject(Error('不可用')); await Promise.all([a,b]);
  assert.equal(f.errors.length,1); assert.equal(f.opening.name.value,undefined);
  const c=f.opening.open('source'); await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(f.calls,['source','source']);
  f.opening.destroy(); f.pending[1].reject(Error('迟到')); await c;
  assert.equal(f.opening.name.value,undefined); assert.equal(f.errors.length,1);
  await f.opening.open('other'); assert.equal(f.calls.length,2);
});
test('最新选择结束后，旧成功不能覆盖它的等待状态',async t=>{
  const original=globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame=callback=>{callback(0);return 1;};
  t.after(()=>{globalThis.requestAnimationFrame=original;});
  const f=fixture(), a=f.opening.open('source'), b=f.opening.open('deploy');
  await new Promise(resolve=>setImmediate(resolve));
  f.pending[0].resolve(); await a; assert.equal(f.opening.name.value,'deploy');
  f.pending[1].resolve(); await b; assert.equal(f.opening.name.value,undefined);
  f.opening.destroy();
});
