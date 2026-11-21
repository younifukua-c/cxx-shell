import { spawnSync } from 'node:child_process';

const FORCE_CLOSE_TIMEOUT_MS = 5000;

async function closeWithin(close, timeoutMs, child) {
  let deadline, exited;
  const observedExit = new Promise(resolve => {
    if (hasExited(child)) resolve();
    else if (child?.once) { exited = resolve; child.once('exit', exited); }
  });
  try {
    await Promise.race([
      Promise.resolve().then(close),
      observedExit,
      new Promise((_, reject) => {
        deadline = setTimeout(() => reject(Error(`[test] 浏览器清理超过 ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(deadline);
    if (exited) child.removeListener('exit', exited);
  }
}

function hasExited(child) {
  return child.exitCode != null || child.signalCode != null;
}

/** 释放独占浏览器；临时套件可指定 force 直接回收，失败仍向入口传播。 */
export async function closeTestBrowser(server, { timeoutMs = 30000, force = false } = {}) {
  const child = server.process();
  try {
    await closeWithin(() => !force && server.close ? server.close() : server.kill(), timeoutMs, child).catch(async error => {
      if (force || !server.close) throw error;
      if (!hasExited(child)) {
        await closeWithin(() => server.kill(), FORCE_CLOSE_TIMEOUT_MS, child).catch(killError => {
          if (!hasExited(child)) {
            throw new AggregateError([error, killError], '[test] 浏览器关闭和强制回收均失败');
          }
        });
      }
      console.warn(`${error.message}，已回收本次独占浏览器`);
    });
  } catch (error) {
    if (child.pid && !hasExited(child)) {
      if (process.platform === 'win32') {
        const result = spawnSync('taskkill', ['/F', '/PID', String(child.pid), '/T'], {
          windowsHide: true, stdio: 'ignore', timeout: FORCE_CLOSE_TIMEOUT_MS,
        });
        if (result.error || result.status !== 0) console.error('[test] 进程树清理失败', result.error || result.status);
      } else child.kill('SIGKILL');
    }
    throw error;
  } finally {
    for (const stream of child.stdio || []) stream?.destroy?.();
    child.unref();
  }
}
