import { createServer } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const port = Number(process.env.CXX_DEMO_PORT || 5176);
const server = await createServer({
  configFile: false,
  root: path.join(root, "apps/workbench"),
  plugins: [vue()],
  cacheDir: path.join(
    process.env.CXX_TEST_SESSION_ROOT || path.join(root, ".local"),
    "vite-" + port,
  ),
  resolve: {
    alias: [
      {
        find: "@cxx/app-shell/dom",
        replacement: path.join(root, "packages/app-shell/src/dom.ts"),
      },
      {
        find: "@cxx/app-shell/style.css",
        replacement: path.join(root, "packages/app-shell/src/dev.css"),
      },
      {
        find: "@cxx/app-shell",
        replacement: path.join(root, "packages/app-shell/src/index.ts"),
      },
    ],
  },
  server: {
    host: "127.0.0.1",
    port,
    strictPort: true,
    fs: { allow: [root] },
    ...(process.env.CXX_TEST_SESSION_ROOT ? { watch: null, hmr: false } : {}),
  },
});
await server.listen();
server.printUrls();
const close = async () => {
  await server.close();
  process.exit(0);
};
process.on("SIGINT", close);
process.on("SIGTERM", close);
