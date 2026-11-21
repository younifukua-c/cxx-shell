import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, ".."),
  out = path.join(root, "desktop/dist");
fs.mkdirSync(out, { recursive: true });
await build({
  entryPoints: [path.join(root, "desktop/preload.cjs")],
  outfile: path.join(out, "preload.cjs"),
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron"],
});
await build({
  entryPoints: [path.join(root, "desktop/renderer/main.ts")],
  outfile: path.join(out, "app.js"),
  bundle: true,
  tsconfigRaw: { compilerOptions: {} },
  platform: "browser",
  format: "esm",
  loader: { ".svg": "dataurl", ".png": "dataurl", ".woff2": "dataurl" },
  splitting: false,
});
fs.copyFileSync(
  path.join(root, "desktop/renderer/index.html"),
  path.join(out, "index.html"),
);
console.log("独立桌面框架已构建。");
