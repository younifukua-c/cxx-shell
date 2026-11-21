import { test, expect } from "@playwright/test";
const root = "/@fs/" + process.cwd().replace(/\\/g, "/");
test("独立原生槽隔离请求，迟到失败不关闭另一个实例，已销毁观察器不再更新", async ({
  page,
}) => {
  await page.goto("/native.html");
  const result = await page.evaluate(async (root) => {
    const { mountWorkspaceSlot } = await import(
      root +
        "/packages/app-shell/src/components/application-framework/shell/account/workspace-slot.ts"
    );
    const nodes = [
      document.createElement("div"),
      document.createElement("div"),
    ];
    for (const node of nodes) {
      Object.assign(node.style, {
        position: "fixed",
        top: "20px",
        left: "20px",
        width: "200px",
        height: "200px",
      });
      document.body.append(node);
    }
    const opened: string[] = [],
      closed: string[] = [],
      resized: string[] = [],
      aborted: boolean[] = [];
    const failures: ((reason: Error) => void)[] = [];
    const port = {
      open(request: { id: string }, signal: AbortSignal) {
        opened.push(request.id);
        signal.addEventListener("abort", () => aborted.push(true));
        return new Promise<void>((_resolve, reject) => failures.push(reject));
      },
      async resize(id: string) {
        resized.push(id);
      },
      async close(id: string) {
        closed.push(id);
      },
    };
    const options = {
      target: { page: "store" as const },
      theme: "dark" as const,
      status() {},
      async completed() {},
    };
    const first = mountWorkspaceSlot(nodes[0]!, port, options),
      second = mountWorkspaceSlot(nodes[1]!, port, options);
    const frame = () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    await frame();
    first.destroy();
    first.destroy();
    failures[0]!(Error("late private failure"));
    nodes[0]!.style.width = "300px";
    second.setTheme("light");
    await frame();
    const before = {
      opened: [...opened],
      closed: [...closed],
      resized: [...resized],
      aborted: [...aborted],
    };
    second.destroy();
    await Promise.resolve();
    for (const node of nodes) node.remove();
    return before;
  }, root);
  expect(result.opened).toHaveLength(2);
  expect(new Set(result.opened).size).toBe(2);
  expect(result.closed).toEqual([result.opened[0]]);
  expect(result.resized).toEqual([result.opened[1]]);
  expect(result.aborted).toEqual([true]);
  expect(await page.pageErrors()).toEqual([]);
});
