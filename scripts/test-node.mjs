import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { runIsolatedTest } from "./test-session.mjs";

const require = createRequire(import.meta.url);
const suite = process.argv[2];
const directory = path.resolve(
  import.meta.dirname,
  suite === "architecture" ? "../tests/architecture" : "../tests",
);
if (!["unit", "architecture"].includes(suite)) throw Error("未知测试套件");
const files = fs
  .readdirSync(directory)
  .filter((name) => /\.test\.(?:ts|cjs)$/.test(name))
  .sort()
  .map((name) => path.join(directory, name));
runIsolatedTest(
  [
    "--import",
    pathToFileURL(require.resolve("tsx")).href,
    "--test",
    "--test-concurrency=4",
    ...process.argv.slice(3),
    ...files,
  ],
  5 * 60 * 1000,
)
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
