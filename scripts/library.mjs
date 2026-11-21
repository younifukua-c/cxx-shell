import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import dts from "vite-plugin-dts";
import fs from "node:fs";
import path from "node:path";
const entries = [
  "index",
  "logging",
  "dom",
  "titlebar",
  "runtime",
  "registry",
  "file-management",
];
export default defineConfig({
  plugins: [
    vue(),
    dts({ include: ["src/**/*"] }),
    {
      name: "shell-styles",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "style.css",
          source: ["titlebar", "style", "logs", "settings", "account"]
            .map((name) => fs.readFileSync("src/" + name + ".css", "utf8"))
            .join("\n"),
        });
      },
    },
  ],
  build: {
    lib: {
      entry: Object.fromEntries(
        entries.map((name) => [name, path.resolve("src/" + name + ".ts")]),
      ),
      formats: ["es", "cjs"],
      fileName: (format, name) =>
        name + "." + (format === "cjs" ? "cjs" : "js"),
      cssFileName: "style",
    },
    rollupOptions: {
      external: (id) =>
        id === "vue" ||
        (id.startsWith("@cxx/") && !id.startsWith("@cxx/icons/assets/")),
    },
    sourcemap: true,
  },
});
