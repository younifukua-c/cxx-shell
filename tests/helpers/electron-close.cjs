"use strict";
// 自动化测试先优雅关闭，再清理本实例的真实 PID 与 Windows cmd 包装进程。
// 两者任一残留都可能持有管道，让已完成的测试无法退出。

const { spawnSync } = require("child_process");

const CLOSE_GRACE_MS = 8000;
const PID_QUERY_MS = 2000;
const applications = new WeakMap();
/** 在通道有效时记下本测试的进程句柄，应用自行退出后仍可安全清理。 */
function rememberApp(application) {
  if (!applications.has(application))
    applications.set(application, {
      wrapper: application.process?.(),
      outcome: null,
    });
  return application;
}

/** 检查测试进程是否仍在运行，查询权限错误必须传播。 */
function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    throw error;
  }
}

/** 终止测试持有的进程树，命令失败且进程仍在时必须报告。 */
function terminateOwnedProcess(pid) {
  if (!isProcessAlive(pid)) return;
  if (process.platform !== "win32") {
    process.kill(pid, "SIGKILL");
    return;
  }
  const result = spawnSync("taskkill", ["/F", "/PID", String(pid), "/T"], {
    windowsHide: true,
    stdio: "ignore",
    timeout: CLOSE_GRACE_MS,
  });
  if ((result.error || result.status !== 0) && isProcessAlive(pid)) {
    throw result.error || Error(`测试进程 ${pid} 清理失败：${result.status}`);
  }
}

/** 等待关闭阶段，并在完成时释放期限定时器。 */
async function withinDeadline(action, timeout, fallback) {
  let deadline;
  try {
    return await Promise.race([
      action(),
      new Promise((resolve) => {
        deadline = setTimeout(() => resolve(fallback), timeout);
      }),
    ]);
  } finally {
    clearTimeout(deadline);
  }
}

/** 清理本次独占的 Electron；force 用于不保存会话的原生夹具。 */
async function closeApp(application, { force = false } = {}) {
  rememberApp(application);
  const state = applications.get(application);
  if (state.outcome) return state.outcome;
  const wrapper = state.wrapper;
  const wrapperPid = wrapper?.pid;
  const pid = await withinDeadline(
    () => application.evaluate(() => process.pid).catch(() => null),
    PID_QUERY_MS,
    null,
  );
  const failures = [];
  let outcome;
  try {
    // 原生夹具由入口持有，在 Chromium 开始正常退出前回收，再确认协议关闭。
    if (force) {
      if (!Number.isInteger(wrapperPid) || wrapperPid <= 0)
        throw Error("缺少测试独占的 Electron 进程句柄");
      terminateOwnedProcess(wrapperPid);
    }
    outcome = await withinDeadline(
      () =>
        application
          .close()
          .then(() => "closed")
          .catch(() => "close-error"),
      CLOSE_GRACE_MS,
      "close-timeout",
    );
    for (const ownedPid of new Set([wrapperPid, pid])) {
      if (!Number.isInteger(ownedPid) || ownedPid <= 0) continue;
      try {
        terminateOwnedProcess(ownedPid);
      } catch (error) {
        failures.push(error);
      }
    }
    if (force && outcome !== "closed")
      failures.push(Error(`Electron 原生夹具回收后协议未关闭：${outcome}`));
  } finally {
    // 已终止的 Windows 包装进程仍可能留有未结束的读管道；测试不再消费它们。
    for (const stream of wrapper?.stdio || []) stream?.destroy?.();
    wrapper?.unref?.();
  }
  if (failures.length)
    throw new AggregateError(failures, "Electron 测试进程清理失败");
  state.outcome = outcome;
  return outcome;
}

module.exports = { rememberApp, closeApp, CLOSE_GRACE_MS };
