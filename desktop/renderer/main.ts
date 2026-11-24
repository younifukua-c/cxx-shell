import { mountDomShell } from "@cxx/app-shell/dom";
import { createAccountClient } from "@cxx/host-runtime/account-client";
import { createButton, createCard, confirmDialog } from "@cxx/ui/dom";
import { CxxLoadingEmpty } from "@cxx/ui";
import { createApp, type App } from "vue";
import "@cxx/ui/style.css";
import addIcon from "@cxx/icons/assets/capability-add.svg";
import shellIcon from "@cxx/icons/assets/38-workspace.svg";
import { applicationLinks } from "./application-links";
import "@cxx/ui/theme.css";
import "@cxx/ui/native.css";
const bridge = (window as any).cxxHost;
const request = async (action: string, extra: Record<string, unknown> = {}) => {
  const result = await bridge.request({ action, ...extra });
  if (!result?.success)
    throw Object.assign(Error(result?.error || "操作未完成，请重试"), {
      code: result?.code,
      guidance: result?.guidance === true,
    });
  return result.value;
};
const sidebar = document.createElement("nav"),
  main = document.createElement("main");
main.style.padding = "24px";
const heading = document.createElement("h1");
heading.textContent = "应用中心";
const list = document.createElement("div");
list.style.display = "grid";
list.style.gap = "16px";
const status = document.createElement("p");
status.setAttribute("role", "status");
const report = (error: unknown) => {
  status.textContent = error instanceof Error ? error.message : String(error);
};
const add = createButton({
  label: "加入软件",
  icon: addIcon,
  onClick: () => request("shell-add").then(refresh).catch(report),
});
const reload = createButton({
  label: "刷新应用目录",
  onClick: () => refresh().catch(report),
});
main.append(heading, add, reload, list, status);
let emptyApp: App | undefined;
const shell = mountDomShell(document.querySelector<HTMLElement>("#app")!, {
  apps: [
    {
      id: "cxx-shell",
      name: "应用中心",
      icon: shellIcon,
      sidebar,
      main,
      accessApplicationId: null,
    },
  ],
  account: createAccountClient(bridge.account),
  windowHost: bridge.window,
  theme: "dark",
  onApplicationLink: (id) =>
    request("open", { applicationId: id }).catch(report),
  onThemeChange: (theme) => {
    void request("shell-theme", { theme }).catch(report);
  },
  onError: report,
});
async function refresh() {
  const value = await request("metadata");
  shell.setTheme(value.theme || "dark");
  const apps = value.applications.filter((item: any) => !item.infrastructure);
  shell.setApplicationLinks(applicationLinks(apps, shellIcon));
  emptyApp?.unmount();
  emptyApp = undefined;
  list.replaceChildren();
  if (!apps.length) {
    const empty = document.createElement("div");
    list.append(empty);
    emptyApp = createApp(CxxLoadingEmpty, {
      title: "尚未加入软件",
      description: "点击“加入软件”选择安装目录，已有业务资料会保留。",
    });
    emptyApp.mount(empty);
  }
  for (const item of apps) {
    const card = createCard().element;
    const title = document.createElement("h2");
    title.textContent = item.name;
    const details = document.createElement("p");
    details.textContent = item.unavailable?.message || "版本 " + item.version;
    const open = createButton({
      label: "打开 " + item.name,
      disabled: !!item.unavailable,
      help: item.unavailable ? { purpose: item.unavailable.message } : undefined,
      onClick: () =>
        request("open", { applicationId: item.id }).catch((error) => {
          report(error);
          if (error.guidance) shell.showAccount();
        }),
    });
    const toggle = createButton({
      label: (item.enabled ? "停用 " : "启用 ") + item.name,
      onClick: () =>
        request("shell-enable", {
          applicationId: item.id,
          enabled: !item.enabled,
        })
          .then(refresh)
          .catch(report),
    });
    const remove = createButton({
      label: "移出 " + item.name,
      onClick: async () => {
        if (
          await confirmDialog({
            title: "从应用中心移出软件",
            message: "将关闭此软件并移出目录，原程序和业务资料保留。",
          })
        ) {
          try {
            await request("shell-remove", { applicationId: item.id });
            await refresh();
          } catch (error) {
            report(error);
          }
        }
      },
    });
    const update = createButton({
      label: "核对更新",
      help: { purpose: "从已加入的软件位置核对新版本，确认后更新应用入口" },
      onClick: async () => {
        try {
          const next = await request("review-local-update", {
            applicationId: item.id,
          });
          if (
            await confirmDialog({
              title: "核对软件更新",
              message:
                item.name +
                "：" +
                next.previousVersion +
                " → " +
                next.version +
                "。确认后使用此位置的当前版本。",
            })
          ) {
            await request("refresh-local-update", {
              applicationId: item.id,
              token: next.token,
            });
            await refresh();
          }
        } catch (error) {
          report(error);
        }
      },
    });
    card.append(title, details, open, toggle, update, remove);
    list.append(card);
  }
}
bridge.onChanged(() => {
  void refresh().catch(report);
});
bridge.setCloseGuard(async () => true);
void refresh().catch(report);
