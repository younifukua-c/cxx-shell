import { test } from "node:test";
import assert from "node:assert/strict";
// 只引叶子模块：目录入口还挂着 Vue 组件与引导框，那是浏览器侧的事。
import {
  OPEN_TOOL_REQUIRED,
  type FileManageClient,
  type OpenResult,
} from "../packages/app-shell/src/file-management/types";
import {
  normalizeFileManagementSettings,
  openerKind,
} from "../packages/app-shell/src/file-management/model";
import { createFileManageActions } from "../packages/app-shell/src/file-management/actions";

/** 只实现被测动作需要的部分，其余给一个明确失败，避免测试悄悄依赖别的分支。 */
function client(overrides: Partial<FileManageClient> = {}): FileManageClient {
  const missing = async () => ({ success: false, error: "未桩住" });
  return {
    getSettings: missing,
    saveSettings: missing,
    pickTool: missing,
    openInFileManager: missing,
    openWithTool: missing,
    openDefault: missing,
    copyPath: missing,
    ...overrides,
  } as FileManageClient;
}

test("缺字段的宿主快照补齐成可渲染的设置", () => {
  assert.deepEqual(normalizeFileManagementSettings(undefined), {
    editor: { command: "", name: "" },
    opening: { folderTarget: "tool", fileTarget: "system", suffixRules: [] },
  });
  assert.deepEqual(
    normalizeFileManagementSettings({ editor: { command: "C:/a.exe" } }),
    {
      editor: { command: "C:/a.exe", name: "" },
      opening: { folderTarget: "tool", fileTarget: "system", suffixRules: [] },
    },
  );
});

test("后缀规则只留带后缀的，后缀统一小写", () => {
  const settings = normalizeFileManagementSettings({
    opening: {
      folderTarget: "system",
      fileTarget: "tool",
      suffixRules: JSON.parse('[{"suffix":" .JAVA ","opener":"tool"},{"suffix":"  "},null,{"opener":"system"}]'),
    },
  });
  assert.equal(settings.opening.folderTarget, "system");
  assert.equal(settings.opening.fileTarget, "tool");
  assert.deepEqual(settings.opening.suffixRules, [
    { suffix: ".java", opener: "tool" },
  ]);
});

test("opener 的两个约定值之外一律按可执行文件处理", () => {
  assert.equal(openerKind("tool"), "tool");
  assert.equal(openerKind("system"), "system");
  assert.equal(openerKind("C:/Tools/idea64.exe"), "custom");
  assert.equal(openerKind(""), "custom");
});

test("同一个打开动作复用在途请求，不重复调用宿主", async () => {
  let calls = 0;
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const actions = createFileManageActions({
    client: client({
      openInFileManager: async () => {
        calls++;
        await gate;
        return { success: true };
      },
    }),
  });
  const first = actions.openInFileManager("/w");
  const second = actions.openInFileManager("/w");
  assert.equal(calls, 1);
  release();
  assert.deepEqual(await first, { success: true });
  assert.deepEqual(await second, { success: true });
  // 收尾之后同一个动作可以再发一次
  await actions.openInFileManager("/w");
  assert.equal(calls, 2);
});

test("工具未配置时先引导配置，配置好才重试一次", async () => {
  const seen: string[] = [];
  let configured = false;
  const actions = createFileManageActions({
    client: client({
      openWithTool: async (): Promise<OpenResult> => {
        seen.push("open");
        return configured
          ? { success: true }
          : {
              success: false,
              code: OPEN_TOOL_REQUIRED,
              configurationGroup: "editor",
            };
      },
    }),
    configure: async (group) => {
      seen.push(`configure:${group}`);
      configured = true;
      return true;
    },
  });
  assert.deepEqual(await actions.openWithTool("/w"), { success: true });
  assert.deepEqual(seen, ["open", "configure:editor", "open"]);
});

test("引导里取消时不重试，也不报错", async () => {
  const seen: string[] = [];
  const errors: string[] = [];
  const actions = createFileManageActions({
    client: client({
      openWithTool: async () => {
        seen.push("open");
        return { success: false, code: OPEN_TOOL_REQUIRED };
      },
    }),
    configure: async (group) => {
      seen.push(`configure:${group}`);
      return false;
    },
    onError: (message) => errors.push(message),
  });
  assert.deepEqual(await actions.openWithTool("/w"), {
    success: false,
    canceled: true,
  });
  // 没给 configurationGroup 时按工具那一组引导
  assert.deepEqual(seen, ["open", "configure:editor"]);
  assert.deepEqual(errors, []);
});

test("打开失败走错误出口，复制成功走成功出口", async () => {
  const errors: string[] = [];
  const notices: string[] = [];
  const actions = createFileManageActions({
    client: client({
      openDefault: async () => ({ success: false, error: "路径不存在" }),
      copyPath: async () => ({ success: true }),
    }),
    onError: (message) => errors.push(message),
    onSuccess: (message) => notices.push(message),
  });
  assert.deepEqual(await actions.openDefault("/nope"), {
    success: false,
    error: "路径不存在",
  });
  assert.deepEqual(errors, ["打开失败：路径不存在"]);
  assert.deepEqual(await actions.copyPath("/w"), { success: true });
  assert.deepEqual(notices, ["已复制"]);
});

test("没有路径时直接拒绝，不去打扰宿主", async () => {
  let calls = 0;
  const actions = createFileManageActions({
    client: client({
      openInFileManager: async () => {
        calls++;
        return { success: true };
      },
      copyPath: async () => {
        calls++;
        return { success: true };
      },
    }),
  });
  assert.deepEqual(await actions.openInFileManager(""), {
    success: false,
    error: "没有可打开的路径",
  });
  assert.deepEqual(await actions.copyPath(""), {
    success: false,
    error: "没有可复制的路径",
  });
  assert.equal(calls, 0);
});

test("内置编辑器按宿主能力显示，重复打开复用请求，失败保留可重试入口", async () => {
  assert.equal(
    createFileManageActions({ client: client() }).openBuiltIn,
    undefined,
  );
  let release!: (result: OpenResult) => void;
  let calls = 0;
  const errors: string[] = [];
  const actions = createFileManageActions({
    client: client({
      openBuiltIn: async () => {
        calls++;
        return new Promise((resolve) => {
          release = resolve;
        });
      },
    }),
    onError: (message) => errors.push(message),
  });
  const first = actions.openBuiltIn!("/project");
  const second = actions.openBuiltIn!("/project");
  assert.equal(first, second);
  assert.equal(calls, 1);
  release({ success: false, error: "暂不可读" });
  assert.equal((await first).success, false);
  assert.equal(errors.length, 1);
  const retry = actions.openBuiltIn!("/project");
  assert.equal(calls, 2);
  release({ success: true });
  assert.equal((await retry).success, true);
});
