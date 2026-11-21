import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";
import { spawn, spawnSync } from "node:child_process";

/** 测试不得使用共享 beta；集成验证须先创建独立 detached Git 检出。 */
export function assertAgentCheckout(cwd = process.cwd()) {
  // stdin 必须显式 ignore：父进程的 stdin 不可复制时（agent、管道里执行），默认建的 stdin 管道会 EBUSY。
  const result = spawnSync("git", ["branch", "--show-current"], {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    timeout: 5000,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error || result.status !== 0)
    throw Error("无法确认测试工作盘的 Git 分支");
  if (result.stdout.trim() === "beta")
    throw Error(
      "beta 是共享集成工作盘，禁止直接测试；请使用自己的 Agent 分支或独立 detached Git 检出。",
    );
}

/** 两个临时端口同时分配，关闭后由 strictPort 开发服务接管。 */
export async function allocateTestPorts() {
  const servers = [];
  try {
    for (let index = 0; index < 2; index++) {
      const server = net.createServer();
      servers.push(server);
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
    }
    return servers.map((server) => String(server.address().port));
  } finally {
    await Promise.all(
      servers.map((server) => new Promise((resolve) => server.close(resolve))),
    );
  }
}

/** 子进程到期只结束本次拥有的进程树，不影响其他 Agent。 */
export function runTestProcess(args, timeoutMs, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      stdio: "inherit",
      env,
      windowsHide: true,
    });
    const deadline = setTimeout(() => {
      console.error(
        `[test] 超过总时限 ${timeoutMs}ms，终止本次测试 PID=${child.pid}`,
      );
      if (child.exitCode === null && child.signalCode === null) {
        if (process.platform === "win32") {
          const result = spawnSync(
            "taskkill",
            ["/F", "/PID", String(child.pid), "/T"],
            {
              windowsHide: true,
              stdio: "ignore",
              timeout: 5000,
            },
          );
          if (result.error || result.status !== 0)
            console.error("[test] 清理失败", result.error || result.status);
        } else child.kill("SIGKILL");
      }
      child.unref();
      resolve(124);
    }, timeoutMs);
    child.once("error", (error) => {
      clearTimeout(deadline);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(deadline);
      resolve(code ?? 1);
    });
  });
}

/** 各 Agent 无排队并行，每次运行使用私有报告、缓存和动态端口。 */
export async function runIsolatedTest(args, timeoutMs, browser = false) {
  assertAgentCheckout();
  const directory = fileURLToPath(new URL("../.local/tests/", import.meta.url));
  fs.mkdirSync(directory, { recursive: true });
  const root = fs.mkdtempSync(path.join(directory, "run-"));
  const artifacts = path.join(root, "artifacts");
  fs.mkdirSync(artifacts);
  const temporary = path.join(root, "tmp");
  fs.mkdirSync(temporary);
  let code = 1;
  console.log(`[test] 本次独立目录：${root}`);
  try {
    const ports = browser ? await allocateTestPorts() : [];
    const env = {
      ...process.env,
      CXX_TEST_SESSION_ROOT: root,
      CXX_TEST_ARTIFACTS_DIR: artifacts,
      TMP: temporary,
      TEMP: temporary,
      TMPDIR: temporary,
      GIT_CEILING_DIRECTORIES: root,
      ...(browser ? { CXX_DEMO_PORT: ports[0], CXX_DOCS_PORT: ports[1] } : {}),
    };
    code = await runTestProcess(args, timeoutMs, env);
    return code;
  } finally {
    for (const entry of fs.readdirSync(root)) {
      if (code !== 0 && entry === "artifacts") continue;
      fs.rmSync(path.join(root, entry), { recursive: true, force: true });
    }
    if (code !== 0) console.error(`[test] 本次报告：${artifacts}`);
    else fs.rmdirSync(root);
  }
}
