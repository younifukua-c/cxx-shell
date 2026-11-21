import path from "node:path";
import { runIsolatedTest } from "./test-session.mjs";
const file = path.resolve(
  import.meta.dirname,
  "../tests/desktop/standalone.test.cjs",
);
const applicationRoot = process.argv
  .find((value) => value.startsWith("--application-root="))
  ?.slice("--application-root=".length);
if (applicationRoot)
  process.env.CXX_SHELL_APPLICATION_ROOT = path.resolve(applicationRoot);
process.exitCode = await runIsolatedTest(["--test", file], 120000);
