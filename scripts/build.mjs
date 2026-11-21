import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { build, Platform } from "electron-builder";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  root = path.resolve(import.meta.dirname, ".."),
  runner = process.env.npm_execpath;
if (!runner?.includes("pnpm")) throw Error("请通过pnpm build构建");
const installer = process.argv.includes("--installer"),
  test = process.argv.includes("--test");
let authority;
if (test) {
  if (installer) throw Error("内部测试构建只生成独立目录，不生成正式安装器");
  authority = { edition: "test" };
} else {
  const file = process.env.CXX_AUTHORITY_PROFILE_FILE;
  if (!file)
    throw Error(
      "请指定正式公开认证配置CXX_AUTHORITY_PROFILE_FILE；内部验证使用pnpm build -- --test",
    );
  authority =
    require("@cxx/host-runtime/account-authority").validateAuthorityProfile(
      JSON.parse(fs.readFileSync(file, "utf8")),
    );
}
for (const action of ["build:framework", "build:desktop"])
  execFileSync(process.execPath, [runner, action], {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
  });
await build({
  projectDir: root,
  targets: Platform.WINDOWS.createTarget(installer ? "nsis" : "dir"),
  config: {
    appId: "com.cxx.shell" + (test ? ".test" : ""),
    productName: require("../package.json").productName,
    directories: {
      output: path.join(root, "dist", test ? "test" : "production"),
    },
    asar: true,
    npmRebuild: false,
    files: [
      {
        from: path.join(root, "desktop"),
        to: "desktop",
        filter: ["**/*", "!renderer/**/*"],
      },
      "package.json",
    ],
    extraMetadata: { cxxAuthority: authority },
    win: { signAndEditExecutable: false },
    nsis: {
      oneClick: false,
      allowToChangeInstallationDirectory: true,
      deleteAppDataOnUninstall: false,
    },
  },
});
