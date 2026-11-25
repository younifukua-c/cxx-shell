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
process.exitCode = await runIsolatedTest(
  [
    "--test",
    path.resolve(
      import.meta.dirname,
      "../tests/desktop/restart-window.test.cjs",
    ),
    file,
    path.resolve(import.meta.dirname, "../tests/desktop/branding.test.cjs"),
    path.resolve(
      import.meta.dirname,
      "../tests/desktop/product-access.test.cjs",
    ),
  ],
  240000,
);
