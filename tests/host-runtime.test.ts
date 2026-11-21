import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const require = createRequire(import.meta.url);
test("宿主全部公开入口独立加载，不依赖产品、UI或Electron", () => {
  const manifest = JSON.parse(
    fs.readFileSync(
      path.join(
        path.dirname(require.resolve("@cxx/host-runtime")),
        "package.json",
      ),
      "utf8",
    ),
  );
  for (const [name, entry] of Object.entries(manifest.exports)) {
    const request =
      name === "." ? "@cxx/host-runtime" : "@cxx/host-runtime/" + name.slice(2);
    assert.ok(require(request), request);
  }
});
test("独立宿主持有隔离资料，原子存储和模块登记保持有效", () => {
  const runtime = require("@cxx/host-runtime");
  const { writeJson } = require("@cxx/host-runtime/files");
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "shell-runtime-"));
  try {
    const environment = runtime.resolveEnvironment({
      options: runtime.launchOptions(["--test-root=" + temp], {}),
      locatorFile: "",
      defaultRoot: temp,
      codeSource: temp,
      userId: "fixture",
    });
    assert.equal(environment.mode, "test");
    const file = runtime
      .createStorage(environment)
      .file("settings", "common", "fixture", "settings.json");
    writeJson(file, { ready: true });
    assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")), {
      ready: true,
    });
    assert.throws(() =>
      runtime
        .createStorage(environment)
        .file("settings", "../bad", "fixture", "bad.json"),
    );
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
