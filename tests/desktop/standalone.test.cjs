"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { _electron: electron, expect } = require("@playwright/test");
const { rememberApp, closeApp } = require("../helpers/electron-close.cjs");
test(
  "独立Shell在没有安装业务应用时正常打开并释放所有窗口",
  { timeout: 60000 },
  async () => {
    const data = fs.mkdtempSync(
      path.join(process.env.CXX_TEST_SESSION_ROOT, "standalone-"),
    );
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.NODE_OPTIONS;
    const app = rememberApp(
      await electron.launch({
        args: [
          path.resolve(__dirname, "../.."),
          "--test-root=" + data,
          "--disable-gpu",
        ],
        env,
        timeout: 20000,
      }),
    );
    try {
      await expect
        .poll(
          () =>
            app
              .context()
              .pages()
              .filter((page) => page.url().endsWith("/index.html")).length,
        )
        .toBeGreaterThan(0);
      const page = app
        .context()
        .pages()
        .find((page) => page.url().endsWith("/index.html"));
      await expect(
        page.getByRole("heading", { name: "应用中心", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "加入软件", exact: true }),
      ).toBeVisible();
      // 隐藏原生窗口不产生截图帧；后台仍核对菜单、DOM 与原生窗口。
      if (process.env.PLAYWRIGHT_TEST !== "1")
      await page.screenshot({
        path: path.join(
          path.resolve(__dirname, "../../.local"),
          "shell-preview.png",
        ),
      });
      const value = await page.evaluate(async () => ({
        node: typeof window.require,
        product: typeof window.repoDock,
        metadata: await window.cxxHost.request({ action: "metadata" }),
        account: await window.cxxHost.account.request({
          action: "account-read",
        }),
      }));
      assert.equal(value.node, "undefined");
      assert.equal(value.product, "undefined");
      assert.equal(value.metadata.success, true);
      assert.deepEqual(
        value.metadata.value.applications.map((item) => item.id),
        ["cxx-shell"],
      );
      assert.equal(value.account.success, true);
      assert.ok(fs.existsSync(path.join(data, "environment.json")));
    } finally {
      const failure = path.join(
        process.env.CXX_TEST_ARTIFACTS_DIR,
        "hosted-startup.txt",
      );
      if (fs.existsSync(failure))
        console.error(fs.readFileSync(failure, "utf8"));
      await closeApp(app, { force: true });
    }
  },
);

test(
  "真实主框架先核验资格再加载公开工厂，关闭释放后可重新加载",
  { timeout: 60000 },
  async () => {
    const data = fs.mkdtempSync(
      path.join(process.env.CXX_TEST_SESSION_ROOT, "hosted-"),
    );
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.NODE_OPTIONS;
    const app = rememberApp(
      await electron.launch({
        args: [
          path.resolve(__dirname, "../helpers/hosted-main.cjs"),
          data,
          "--disable-gpu",
        ],
        env,
        timeout: 20000,
      }),
    );
    try {
      await expect
        .poll(() => app.evaluate(() => !!globalThis.shellQA))
        .toBe(true);
      const denied = await app.evaluate(async () => {
        try {
          await globalThis.shellQA.open();
          return null;
        } catch (error) {
          return error.code;
        }
      });
      assert.equal(denied, "NO_SUBSCRIPTION");
      assert.equal(fs.existsSync(path.join(data, "fixture/events.log")), false);
      await app.evaluate(async () => {
        globalThis.shellQA.state.denied = false;
        await globalThis.shellQA.open();
      });
      await expect
        .poll(() => fs.existsSync(path.join(data, "fixture/events.log")))
        .toBe(true);
      await app.evaluate(() => globalThis.shellQA.close());
      await expect
        .poll(() =>
          fs
            .readFileSync(path.join(data, "fixture/events.log"), "utf8")
            .includes("dispose:1"),
        )
        .toBe(true);
      await app.evaluate(() => globalThis.shellQA.open());
      assert.equal(
        fs.readFileSync(path.join(data, "fixture/events.log"), "utf8"),
        "load:1\ndispose:1\nload:1\n",
      );
      assert.ok(
        (await app.evaluate(() => globalThis.shellQA.state.calls)).length >= 3,
      );
    } finally {
      const failure = path.join(
        process.env.CXX_TEST_ARTIFACTS_DIR,
        "hosted-startup.txt",
      );
      if (fs.existsSync(failure))
        console.error(fs.readFileSync(failure, "utf8"));
      await closeApp(app, { force: true });
    }
  },
);

test(
  "打出的独立EXE在显式测试环境启动，不依赖源码工作盘",
  { timeout: 60000 },
  async () => {
    const executable = path.resolve(
      __dirname,
      "../../dist/test/win-unpacked/CXX Shell.exe",
    );
    assert.equal(
      fs.existsSync(executable),
      true,
      "先执行 pnpm build -- --test",
    );
    const data = fs.mkdtempSync(
      path.join(process.env.CXX_TEST_SESSION_ROOT, "packaged-"),
    );
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.NODE_OPTIONS;
    const app = rememberApp(
      await electron.launch({
        executablePath: executable,
        args: ["--test-root=" + data, "--disable-gpu"],
        env,
        timeout: 20000,
      }),
    );
    try {
      await expect
        .poll(
          () =>
            app
              .context()
              .pages()
              .filter((page) => page.url().endsWith("/index.html")).length,
        )
        .toBeGreaterThan(0);
      const page = app
        .context()
        .pages()
        .find((page) => page.url().endsWith("/index.html"));
      await expect(
        page.getByRole("heading", { name: "应用中心", exact: true }),
      ).toBeVisible();
      assert.equal(await app.evaluate(({ app }) => app.isPackaged), true);
    } finally {
      const failure = path.join(
        process.env.CXX_TEST_ARTIFACTS_DIR,
        "hosted-startup.txt",
      );
      if (fs.existsSync(failure))
        console.error(fs.readFileSync(failure, "utf8"));
      await closeApp(app, { force: true });
    }
  },
);

test(
  "RepoDock作为公开子应用保存Git项目，关闭重开保留数据并释放IPC",
  {
    timeout: 60000,
    skip:
      !process.env.CXX_SHELL_APPLICATION_ROOT ||
      require(path.join(process.env.CXX_SHELL_APPLICATION_ROOT, "package.json"))
        .cxxApplication?.id !== "source-derived",
  },
  async () => {
    const data = fs.mkdtempSync(
      path.join(process.env.CXX_TEST_SESSION_ROOT, "repodock-"),
    );
    const repository = path.join(data, "repository");
    fs.mkdirSync(repository);
    const { execFileSync } = require("node:child_process");
    const git = (...args) =>
      execFileSync("git", ["-C", repository, ...args], {
        windowsHide: true,
        env: {
          ...process.env,
          GIT_CONFIG_GLOBAL: path.join(data, "none"),
          GIT_CONFIG_NOSYSTEM: "1",
        },
      });
    git("init", "--quiet");
    fs.writeFileSync(path.join(repository, "README.md"), "fixture");
    git("add", ".");
    git(
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@local",
      "commit",
      "--quiet",
      "-m",
      "fixture",
    );
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.NODE_OPTIONS;
    const app = rememberApp(
      await electron.launch({
        args: [
          path.resolve(__dirname, "../helpers/hosted-main.cjs"),
          path.join(data, "environment"),
          path.resolve(process.env.CXX_SHELL_APPLICATION_ROOT),
          "--disable-gpu",
        ],
        env,
        timeout: 20000,
      }),
    );
    try {
      await expect
        .poll(() => app.evaluate(() => !!globalThis.shellQA))
        .toBe(true);
      await app.evaluate(() => globalThis.shellQA.open());
      let page = app
        .context()
        .pages()
        .find((page) => page.url().endsWith("/src/index.html"));
      assert.ok(page, "子应用实际加载产品视图");
      await expect
        .poll(() => page.evaluate(() => typeof window.repoDock?.saveProject))
        .toBe("function");
      const save = await page.evaluate(
        (project) => window.repoDock.saveProject(project),
        {
          id: "fixture-git",
          name: "合成Git项目",
          path: repository,
          vcsType: "git",
        },
      );
      assert.equal(save.success, true, JSON.stringify(save));
      const projects = await page.evaluate(() =>
        window.repoDock.listProjects(),
      );
      assert.ok(projects.some((item) => item.id === "fixture-git"));
      const info = await page.evaluate(
        (workdir) => window.repoDock.getSourceInfo(workdir),
        repository,
      );
      assert.equal(info.success, true, JSON.stringify(info));
      await app.evaluate(() => globalThis.shellQA.close());
      await expect
        .poll(() =>
          app.evaluate(
            () =>
              !!globalThis.shellQA.composition.host.contents("source-derived"),
          ),
        )
        .toBe(false);
      await app.evaluate(() => globalThis.shellQA.open());
      page = app
        .context()
        .pages()
        .find((page) => page.url().endsWith("/src/index.html"));
      assert.ok(
        (await page.evaluate(() => window.repoDock.listProjects())).some(
          (item) => item.id === "fixture-git",
        ),
      );
    } finally {
      const failure = path.join(
        process.env.CXX_TEST_ARTIFACTS_DIR,
        "hosted-startup.txt",
      );
      if (fs.existsSync(failure))
        console.error(fs.readFileSync(failure, "utf8"));
      await closeApp(app, { force: true });
    }
  },
);

test(
  "部署流由独立Shell直接加载并释放自己的后台与运行环境",
  {
    timeout: 90000,
    skip:
      !process.env.CXX_SHELL_APPLICATION_ROOT ||
      require(path.join(process.env.CXX_SHELL_APPLICATION_ROOT, "package.json"))
        .cxxApplication?.id !== "deploy-flow",
  },
  async () => {
    const data = fs.mkdtempSync(
      path.join(process.env.CXX_TEST_SESSION_ROOT, "deploy-flow-"),
    );
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.NODE_OPTIONS;
    const app = rememberApp(
      await electron.launch({
        args: [
          path.resolve(__dirname, "../helpers/hosted-main.cjs"),
          path.join(data, "environment"),
          path.resolve(process.env.CXX_SHELL_APPLICATION_ROOT),
          "--disable-gpu",
        ],
        env,
        timeout: 20000,
      }),
    );
    try {
      await expect
        .poll(() => app.evaluate(() => !!globalThis.shellQA))
        .toBe(true);
      await app.evaluate(() => globalThis.shellQA.open());
      const page = app
        .context()
        .pages()
        .find((page) => /^http:\/\/127\.0\.0\.1:/.test(page.url()));
      assert.ok(page, "部署流应加载自己的后台页面");
      await expect(page.locator("body")).not.toBeEmpty();
      await app.evaluate(() => globalThis.shellQA.close());
      await expect
        .poll(() =>
          app.evaluate(
            () => !!globalThis.shellQA.composition.host.contents("deploy-flow"),
          ),
        )
        .toBe(false);
      await app.evaluate(() => globalThis.shellQA.open());
      assert.ok(
        app
          .context()
          .pages()
          .some((page) => /^http:\/\/127\.0\.0\.1:/.test(page.url())),
      );
    } finally {
      const failure = path.join(
        process.env.CXX_TEST_ARTIFACTS_DIR,
        "hosted-startup.txt",
      );
      if (fs.existsSync(failure))
        console.error(fs.readFileSync(failure, "utf8"));
      await closeApp(app, { force: true });
    }
  },
);
