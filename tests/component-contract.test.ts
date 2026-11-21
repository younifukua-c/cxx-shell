import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { parse, compileScript, registerTS } from "vue/compiler-sfc";
import { appShellComponentRegistry } from "../packages/app-shell/src/registry";
registerTS(() => ts);
test("框架组件注册参数覆盖真实公开Vue属性，合同随实现同仓维护", () => {
  const barrel = fs.readFileSync("packages/app-shell/src/index.ts", "utf8");
  for (const item of appShellComponentRegistry.filter(
    (item) => item.type === "vue",
  )) {
    const match = barrel.match(
      new RegExp("default as " + item.exportName + " \} from '([^']+)';"),
    );
    assert.ok(match, item.id);
    const file = path.resolve("packages/app-shell/src", match[1]);
    const { descriptor } = parse(fs.readFileSync(file, "utf8"), {
      filename: file,
    });
    const compiled = compileScript(descriptor, {
      id: item.id,
      fs: {
        fileExists: fs.existsSync,
        readFile: (file) => fs.readFileSync(file, "utf8"),
      },
    });
    const names = item.props.flatMap((row) =>
      row.name
        .split(/\s*\/\s*/)
        .map((name) =>
          name.replace(
            /^v-model(?::(.+))?$/,
            (_, model) => model || "modelValue",
          ),
        ),
    );
    for (const [name, kind] of Object.entries(compiled.bindings || {}))
      if (kind === "props")
        assert.ok(names.includes(name), item.id + "." + name);
  }
});
