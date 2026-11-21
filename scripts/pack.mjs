import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const runner = process.env.npm_execpath;
if (!runner?.includes("pnpm")) throw Error("请通过 pnpm pack:all 运行");
const root = path.resolve(import.meta.dirname, "..");
const destination = path.resolve(
  process.argv[2] || path.join(root, "artifacts"),
);
fs.mkdirSync(destination, { recursive: true });
execFileSync(process.execPath, [runner, "build:framework"], {
  cwd: root,
  stdio: "inherit",
  windowsHide: true,
});
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "cxx-shell-pack-"));
const digest = (file) =>
  createHash("sha512").update(fs.readFileSync(file)).digest("base64");
try {
  const packages = {};
  for (const name of ["app-shell", "host-runtime"]) {
    const folder = path.join(root, "packages", name);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(folder, "package.json"), "utf8"),
    );
    const filename = "cxx-" + name + "-" + manifest.version + ".tgz";
    execFileSync(
      process.execPath,
      [runner, "pack", "--pack-destination", temporary],
      { cwd: folder, stdio: "inherit", windowsHide: true },
    );
    const candidate = path.join(temporary, filename),
      target = path.join(destination, filename);
    const sha512 = digest(candidate);
    if (fs.existsSync(target)) {
      if (digest(target) !== sha512)
        throw Error(
          manifest.name +
            " 同版本归档内容发生变化，请分配新版本；原归档未修改。",
        );
    } else fs.copyFileSync(candidate, target, fs.constants.COPYFILE_EXCL);
    packages[manifest.name] = {
      version: manifest.version,
      file: filename,
      integrity: "sha512-" + sha512,
    };
  }
  fs.writeFileSync(
    path.join(destination, "packages.json"),
    JSON.stringify(packages, null, 2) + "\n",
  );
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
