import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
const require = createRequire(import.meta.url),
  root = path.resolve(import.meta.dirname, "..");
const runner = process.env.npm_execpath;
if (!runner?.includes("pnpm")) throw Error("请通过pnpm start启动");
const build = spawn(process.execPath, [runner, "build:desktop"], {
  cwd: root,
  stdio: "inherit",
  windowsHide: true,
});
build.once("exit", (code) => {
  if (code) {
    process.exitCode = code;
    return;
  }
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = spawn(require("electron"), [root, ...process.argv.slice(2)], {
    cwd: root,
    env,
    stdio: "inherit",
    windowsHide: true,
  });
  app.once("exit", (code) => {
    process.exitCode = code ?? 1;
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => app.kill(signal));
});
