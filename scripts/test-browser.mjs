import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { closeTestBrowser } from "./test-browser-cleanup.mjs";
import { runIsolatedTest, runTestProcess } from "./test-session.mjs";

const require = createRequire(import.meta.url);
const DEFAULT_TIMEOUT_MS = 6 * 60 * 1000;
const REPORT_GRACE_MS = 10000;

/** 测试入口独占浏览器，工作进程仅连接它，结束后统一释放进程树。 */
async function run() {
  const args = process.argv.slice(2);
  const timeoutOption = args.find((arg) => arg.startsWith("--global-timeout="));
  const timeoutIndex = args.indexOf("--global-timeout");
  const timeout = timeoutOption
    ? Number(timeoutOption.split("=")[1])
    : timeoutIndex >= 0
      ? Number(args[timeoutIndex + 1])
      : DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeout) || timeout <= 0)
    throw Error("测试总时限必须大于 0");
  if (!timeoutOption && timeoutIndex < 0)
    args.push(`--global-timeout=${timeout}`);
  if (process.argv[2] !== "--session-worker") {
    process.exitCode = await runIsolatedTest(
      [fileURLToPath(import.meta.url), "--session-worker", ...args],
      timeout + 60000,
      true,
    );
    return;
  }
  args.shift();
  const server = await chromium.launchServer({
    channel: process.env.CXX_TEST_BROWSER_CHANNEL || "chrome",
    headless: !args.includes("--headed") && !args.includes("--debug"),
    timeout: 30000,
  });
  try {
    const cli = path.join(
      path.dirname(require.resolve("@playwright/test/package.json")),
      "cli.js",
    );
    process.exitCode = await runTestProcess(
      [cli, "test", ...args],
      timeout + REPORT_GRACE_MS,
      { ...process.env, CXX_TEST_BROWSER_WS_ENDPOINT: server.wsEndpoint() },
    );
  } finally {
    // 本入口独占临时浏览器，无需保存会话；直接回收，避免 Windows 正常退出停在原生句柄等待。
    await closeTestBrowser(server, { force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
