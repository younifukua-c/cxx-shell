import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** 按仓库清单检查工具身份及锁文件；不清理或替换依赖。 */
export function assertPackageManager({
  root = path.resolve(import.meta.dirname, ".."),
  userAgent = process.env.npm_config_user_agent || "",
} = {}) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8"),
  );
  const [manager, version] = (manifest.packageManager || "").split("@");
  const identity = userAgent.split(" ")[0];
  if (!manager || identity !== manager + "/" + version)
    throw new Error(
      manifest.name +
        " 只允许使用 " +
        manifest.packageManager +
        "。安装请运行 pnpm install --frozen-lockfile，启动请运行 pnpm start。",
    );
  for (const file of [
    "package-lock.json",
    "npm-shrinkwrap.json",
    "yarn.lock",
  ]) {
    if (fs.existsSync(path.join(root, file)))
      throw new Error(
        "发现其他包管理器的锁文件 " +
          file +
          "；请保留需用的文件，在独立干净目录通过 pnpm install --frozen-lockfile 安装，禁止混用依赖目录。",
      );
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    assertPackageManager();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
