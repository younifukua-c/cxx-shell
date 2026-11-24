import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { build } from "esbuild";
const root = path.resolve(import.meta.dirname, "..");
const runner = process.env.npm_execpath;
if (!runner?.includes("pnpm")) throw Error("请使用pnpm test:consumer");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "cxx-shell-consumer-"));
const archiveDirectory = path.resolve(process.env.CXX_SHELL_CONSUMER_PACKAGES || path.join(root, "artifacts"));
const artifacts = {};
for (const [name, folder] of [
  ["app-shell", "packages/app-shell"],
  ["host-runtime", "packages/host-runtime"],
]) {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(root, folder, "package.json"), "utf8"),
  );
  artifacts["@cxx/" + name] =
    "file:" +
    path
      .join(archiveDirectory, "cxx-" + name + "-" + pkg.version + ".tgz")
      .split(path.sep)
      .join("/");
}
artifacts["@cxx/ui"] =
  "file:" +
  path.join(root, JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).devDependencies["@cxx/ui"].slice(5)).split(path.sep).join("/");
artifacts["@cxx/icons"] =
  "file:" +
  path.join(root, "vendor/cxx/cxx-icons-0.7.0.tgz").split(path.sep).join("/");
try {
  fs.writeFileSync(
    path.join(temp, "package.json"),
    JSON.stringify({
      name: "shell-independent-consumer",
      version: "1.0.0",
      private: true,
      type: "module",
      dependencies: { ...artifacts, vue: "3.5.43" },
      pnpm: { overrides: artifacts, onlyBuiltDependencies: ["esbuild"] },
    }),
  );
  execFileSync(process.execPath, [runner, "install", "--ignore-workspace"], {
    cwd: temp,
    stdio: "inherit",
    windowsHide: true,
    timeout: 120000,
  });
  const require = createRequire(path.join(temp, "consumer.cjs"));
  const runtime = require("@cxx/host-runtime");
  const environment = runtime.resolveEnvironment({
    options: runtime.launchOptions(
      ["--test-root=" + path.join(temp, "data")],
      {},
    ),
    locatorFile: "",
    defaultRoot: temp,
    codeSource: temp,
    userId: "consumer",
  });
  assert.equal(environment.mode, "test");

  const modules = require('@cxx/host-runtime/application-modules').createApplicationModules(environment);
  for (const [id, name, productCode] of [
    ['source-derived', 'cxx-repodock', 'cxx-repodock'], ['deploy-flow', 'cxx-deploy-flow', 'deploy-flow'],
  ]) {
    const root = path.join(temp, id); fs.mkdirSync(root);
    fs.writeFileSync(path.join(root, 'entry.cjs'), 'exports.createApplication=()=>({})');
    fs.writeFileSync(path.join(root, 'preload.cjs'), '');
    const pkg = { name, version: '1.0.0', cxxApplication: {
      id, name, productCode, entry: 'entry.cjs', preload: 'preload.cjs',
    } };
    const file = path.join(root, 'package.json'); fs.writeFileSync(file, JSON.stringify(pkg));
    const inspect = require('@cxx/host-runtime/installation-discovery').inspectApplication;
    modules.register(inspect(root));
    const recordFile = runtime.createStorage(environment).file('settings', 'common', 'host-runtime', 'modules/' + id + '.json');
    const old = JSON.parse(fs.readFileSync(recordFile)); old.module.productCode = name;
    delete old.module.productCodeSource; fs.writeFileSync(recordFile, JSON.stringify(old));
    const before = fs.readFileSync(recordFile, 'utf8');
    assert.equal(modules.list().find(item => item.id === id).productCode, productCode);
    assert.equal(modules.resolve(id).id, id);
    assert.equal(fs.readFileSync(recordFile, 'utf8'), before);
    modules.register(inspect(root)); pkg.cxxApplication.productCode = 'changed-product';
    fs.writeFileSync(file, JSON.stringify(pkg));
    assert.throws(() => modules.resolve(id), { code: 'MODULE_CHANGED' });
  }

  const redirected = path.join(temp, 'deploy-flow'), moved = path.join(temp, 'moved-deploy-flow');
  fs.renameSync(redirected, moved); fs.symlinkSync(moved, redirected, process.platform === 'win32' ? 'junction' : 'dir');
  const broken = modules.list().find(item => item.id === 'deploy-flow');
  assert.equal(broken.root, redirected); assert.equal(broken.unavailable.code, 'MODULE_UNAVAILABLE');
  assert.throws(() => modules.resolve('deploy-flow'), { code: 'MODULE_IDENTITY_CHANGED' });
  assert.ok(modules.list().find(item => item.id === 'source-derived' && !item.unavailable));

  const manifest = JSON.parse(
    fs.readFileSync(
      path.join(
        path.dirname(require.resolve("@cxx/host-runtime")),
        "package.json",
      ),
      "utf8",
    ),
  );
  for (const entry of Object.keys(manifest.exports))
    assert.ok(
      require(
        entry === "."
          ? "@cxx/host-runtime"
          : "@cxx/host-runtime/" + entry.slice(2),
      ),
    );

  const typeFixture=path.join(temp,'consumer.cts');
  fs.writeFileSync(typeFixture,`import {createExternalApplications} from '@cxx/host-runtime/application-loader';
import type {Environment, ApplicationHost} from '@cxx/host-runtime';
declare const host:ApplicationHost; void host.open('example',{activate:false});
const loader=createExternalApplications({runtime:{environment:{} as Environment},electron:{}});
loader.descriptor('example');
void loader.cleanupProject('example',{},'task',new AbortController().signal,(completed,total)=>{
  const count:number=completed+total; void count;
});
`);
  const compiler=createRequire(import.meta.url).resolve('typescript/bin/tsc');
  execFileSync(process.execPath,[compiler,'--noEmit','--strict','--module','Node16','--target','ES2022',
    '--typeRoots',path.join(root,'node_modules/@types'),typeFixture],{cwd:temp,stdio:'inherit',windowsHide:true,timeout:30000});
  await build({
    stdin: {
      contents:
        "import {mountDomShell} from '@cxx/app-shell/dom';import {createAccountClient} from '@cxx/host-runtime/account-client';console.log(mountDomShell,createAccountClient);",
      resolveDir: temp,
      loader: "ts",
    },
    bundle: true,
    write: false,
    platform: "browser",
    format: "esm",
    loader: { ".svg": "dataurl" },
    logLevel: "error",
  });
  console.log(
    "独立tarball消费通过：运行环境、全部公开入口和浏览器外壳均不依赖产品或兄弟源码。",
  );
} finally {
  if (
    path.dirname(temp) !== path.resolve(os.tmpdir()) ||
    !path.basename(temp).startsWith("cxx-shell-consumer-")
  )
    throw Error("拒绝越界清理");
  fs.rmSync(temp, { recursive: true, force: true });
}
