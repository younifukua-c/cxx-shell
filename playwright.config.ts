import { defineConfig } from "@playwright/test";
import path from "node:path";
const port = Number(process.env.CXX_DEMO_PORT || 5176);
export default defineConfig({
  testDir: "tests/browser",
  timeout: 30000,
  expect: { timeout: 5000 },
  workers: 2,
  outputDir: path.join(
    process.env.CXX_TEST_ARTIFACTS_DIR || "test-results",
    "results",
  ),
  use: {
    baseURL: "http://127.0.0.1:" + port,
    connectOptions: process.env.CXX_TEST_BROWSER_WS_ENDPOINT
      ? { wsEndpoint: process.env.CXX_TEST_BROWSER_WS_ENDPOINT }
      : undefined,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm start:web",
    url: "http://127.0.0.1:" + port,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
