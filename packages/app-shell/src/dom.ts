import { createApp, h, ref, watch, nextTick, computed } from 'vue';
import { uiStyles } from '@cxx/ui/styles';
import { createViewScope, installIconStates } from '@cxx/ui/dom';
import type { ThemeName } from '@cxx/ui';
import ShellChrome from './components/application-framework/shell/app/internal/ShellChrome.vue';
import shell from './style.css?inline';
import titlebar from './titlebar.css?inline';
import logStyles from './logs.css?inline';
import settingsStyles from './settings.css?inline';
import accountStyles from './account.css?inline';
import fileManageStyles from './file-management.css?inline';
import type { SettingsItem } from './settings';
import { createMemoryLogClient, type LogClient, type LogType } from './logging';
import type { FileManageClient } from './file-management/index';
import type { LogScope } from './components/application-framework/log/center/CxxLogCenter.vue';
import type { ShellAction, ShellView, WindowHost } from './types';
import { isReservedApplicationId, validateApplicationMenuGroup, type ApplicationMenuGroup } from './application-entry';
import type { PersonalAccountClient, PersonalWorkspaceTarget } from './account';
import { projectApplicationMenu, type ApplicationMenuEntry } from './application-menu';
import { applicationMenuIcon } from './application-menu-icons';
export type { ApplicationMenuEntry } from './application-menu';
import { mountDomSlots } from './dom-slots';

/** 已有 DOM 应用：业务节点保留在文档树，外壳在 Shadow DOM 内隔离。 */
export interface DomApplication {
  id: string;
  name: string;
  icon?: string;
  /** 默认使用 id；string 映射宿主软件资格与商城，null 显式声明公共页面。 */
  accessApplicationId?: string | null;
  /** 同组有多个入口时，由外壳显示为级联菜单。 */
  menuGroup?: ApplicationMenuGroup;
  sidebar: HTMLElement;
  /** 当前应用可选的固定侧栏顶部内容，位于应用选择器下方。 */
  sidebarHeader?: HTMLElement;
  /** 侧栏可拖至的最小宽度；图标导航可传 72，普通内容默认 180。 */
  sidebarMinWidth?: number;
  main: HTMLElement;
  accountActions?: readonly ShellAction[];
  logTypes?: readonly LogType[];
  settings?: readonly DomSettingsSection[];
}
/** 原生表单投影到设置页，节点留在文档树；onOpen 每次进入该页读取宿主数据。 */
export interface DomSettingsSection extends Omit<SettingsItem, 'group'> {
  content: HTMLElement;
  onOpen?: () => void | Promise<void>;
}
/** 其他原生页面的应用入口；选择后交给宿主，不创建或替换当前业务节点。 */
export type DomApplicationLink = Pick<DomApplication, "id" | "name" | "icon" | "accessApplicationId" | "menuGroup">;
export interface DomShellOptions {
  applicationLinks?: readonly DomApplicationLink[];
  onApplicationLink?: (id: string, entryId?: string) => void | Promise<void>;
  apps: readonly DomApplication[];
  initialApp?: string;
  accountName?: string;
  /** 可选的个人中心宿主端口；不提供时维持原有帮助菜单。 */
  account?: PersonalAccountClient;
  commonActions?: readonly ShellAction[];
  windowHost?: WindowHost;
  theme?: ThemeName;
  onAppChange?: (id: string) => void;
  /** 应用、设置页或日志页真正变化时通知宿主，重复选择不触发。 */
  onViewChange?: (view: ShellView) => void;
  onError: (error: unknown) => void;
  logging?: LogClient;
  /** 公共任务车。提供 content 时在独立页面展示，onOpen 用于读取任务。 */
  taskCart?: { icon?: string; content?: HTMLElement; sidebar?: HTMLElement; onOpen?(): void | Promise<void> };
  /** 文件管理能力的宿主实现；传了才在设置页出现「文件夹与打开方式」。 */
  fileManagement?: FileManageClient;
  onLogViewChange?: (open: boolean) => void;
  onClearLogScope?: () => void;
  settingsSections?: readonly DomSettingsSection[];
  onThemeChange?: (theme: ThemeName) => void;
  onHelp?: () => void | Promise<void>;
}

/** 应用区域共同参与节点所有权校验、挂载和交互清理。 */
function applicationNodes(app: DomApplication): HTMLElement[] {
  return app.sidebarHeader ? [app.sidebarHeader, app.sidebar, app.main] : [app.sidebar, app.main];
}

/** 挂载现有页面；不同应用必须提供各自节点，切换保留节点及事件、输入与滚动状态。 */
export function mountDomShell(host: HTMLElement, options: DomShellOptions) {
  const ids = new Set<string>();
  const nodes = new Set<HTMLElement>();
  const groups = new Map<string, ApplicationMenuGroup>();
  for (const app of options.apps) {
    validateApplicationMenuGroup(app.menuGroup, groups);
    if (app.accessApplicationId != null && (typeof app.accessApplicationId !== 'string' || !app.accessApplicationId.trim()))
      throw new Error('软件资格标识不能为空');
    if (!app.id || isReservedApplicationId(app.id) || !app.name || ids.has(app.id))
      throw new Error(`应用 id 为空或重复：${app.id}`);
    ids.add(app.id);
    for (const node of applicationNodes(app)) {
      if (nodes.has(node)) throw new Error('不同应用区域必须使用各自的 DOM 节点');
      nodes.add(node);
    }
  }
  if (!options.apps.length) throw new Error('至少需要一个应用');
  const sections = [
    ...(options.settingsSections || []).map((item) => ({
      ...item,
      id: `product:${item.id}`,
      group: '公共设置',
      appId: '',
    })),
    ...options.apps.flatMap((app) =>
      (app.settings || []).map((item) => ({
        ...item,
        id: `app:${app.id}:${item.id}`,
        group: `${app.name}设置`,
        appId: app.id,
      })),
    ),
  ];
  const sectionIds = new Set<string>();
  for (const section of sections) {
    if (!section.label || sectionIds.has(section.id) || nodes.has(section.content))
      throw new Error('设置 id 或内容节点重复');
    sectionIds.add(section.id);
    nodes.add(section.content);
  }
  const current = ref(
    ids.has(options.initialApp || '') ? options.initialApp! : options.apps[0]!.id,
  );
  const links = ref<DomApplicationLink[]>([]);
  const applicationMenu = ref<readonly ApplicationMenuEntry[]>();
  const menuOwner = options.apps[0]!.menuGroup?.id || options.apps[0]!.id;
  const publicMenuEntries = new Set(
    options.apps
      .filter((item) => item.accessApplicationId === null)
      .map((item) => item.id),
  );
  const menuProjection = computed(
    () =>
      applicationMenu.value &&
      projectApplicationMenu(
        applicationMenu.value,
        menuOwner,
        applicationMenuIcon,
        publicMenuEntries,
      ),
  );
  /** 宿主整批发布安装目录，当前应用不能重排或替换一级入口。 */
  function setApplicationMenu(value: readonly ApplicationMenuEntry[]) {
    if (destroyed) throw Error("外壳已销毁");
    projectApplicationMenu(value, menuOwner);
    applicationMenu.value = value;
  }
  const openingApplication = ref<string>();
  const openingTasks = new Map<string, Promise<void>>();
  let openingRevision = 0;
  /** 同一软件复用在途加载，画面只跟随最近一次选择，失败恢复原节点。 */
  function openApplicationLink(id: string, entryId?: string) {
    const taskKey = id + ":" + (entryId || "");
    const revision = ++openingRevision;
    openingApplication.value = [
      ...options.apps,
      ...links.value,
      ...(applicationMenu.value || []),
    ].find((item) => item.id === id)?.name;
    chrome.value?.showApplication();
    let task = openingTasks.get(taskKey);
    if (!task) {
      task = nextTick()
        .then(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => resolve()),
            ),
        )
        .then(() => {
          if (!destroyed) return options.onApplicationLink?.(id, entryId);
        });
      openingTasks.set(taskKey, task);
      const release = () => {
        if (openingTasks.get(taskKey) === task) openingTasks.delete(taskKey);
      };
      void task.then(release, release);
    }
    return task
      .catch((error) => {
        if (!destroyed && revision === openingRevision) options.onError(error);
      })
      .finally(() => {
        if (!destroyed && revision === openingRevision)
          openingApplication.value = undefined;
      });
  }
  /** 整批校验通过才发布入口；失败保留上一份列表。 */
  function setApplicationLinks(value: readonly DomApplicationLink[]) {
    if (destroyed) throw new Error("外壳已销毁");
    if (!Array.isArray(value) || value.length > 200 || (value.length && !options.onApplicationLink))
      throw new Error("应用入口数量或回调无效");
    const used = new Set(ids);
    const nextGroups = new Map(groups);
    const next = value.map(item => {
      if (!item || typeof item.id !== "string" || !item.id || isReservedApplicationId(item.id) || used.has(item.id) || typeof item.name !== "string" || !item.name.trim())
        throw new Error("应用入口 id 或名称无效");
      used.add(item.id);
      if (item.accessApplicationId != null && (typeof item.accessApplicationId !== 'string' || !item.accessApplicationId.trim())) throw new Error('软件资格标识不能为空');
      validateApplicationMenuGroup(item.menuGroup, nextGroups);
      return { id: item.id, name: item.name, icon: item.icon, accessApplicationId: item.accessApplicationId,
        menuGroup: item.menuGroup && { ...item.menuGroup } };
    });
    links.value = next;
  }
  let destroyed = false;
  setApplicationLinks(options.applicationLinks || []);
  const theme = ref(options.theme || 'dark');
  const logging = options.logging || createMemoryLogClient(options.apps);
  const chrome = ref<InstanceType<typeof ShellChrome>>();
  const logScope = ref<LogScope>();
  const logRevision = ref(0);
  const taskFailures = ref(0);
  const sidebarFocused = ref(false);
  const visitedSettings = new Set<string>();
  const taskNodes = [
    [options.taskCart?.content, 'task-cart'],
    [options.taskCart?.sidebar, 'task-cart-sidebar'],
  ] as const;
  const restoreSlots = mountDomSlots(host, [
    ...options.apps.flatMap((app, index) => [
      [app.sidebarHeader, `sidebar-header-${index}`],
      [app.sidebar, `sidebar-${index}`],
      [app.main, `main-${index}`],
    ] as const),
    ...sections.map((section, index) => [section.content, `settings-${index}`] as const),
    ...taskNodes,
  ]);
  const root = mountRoot(host);
  const shellScope = createViewScope(host, { onError: options.onError });
  const appScopes = new Map(options.apps.map(app => [app.id,
    createViewScope(applicationNodes(app), { active: false, onError: options.onError })]));
  const settingScopes = new Map(sections.map(section => [section.id,
    createViewScope(section.content, { active: false, onError: options.onError })]));
  let viewKey = '';
  let announcedApp: string | undefined;
  /** 页面统一退出临时界面，主页面与表单节点仍保留。 */
  function changeView(view: ShellView) {
    const key = JSON.stringify(view);
    if (key === viewKey) return;
    viewKey = key;
    sidebarFocused.value = false;
    shellScope.reset();
    for (const [id, scope] of appScopes) scope.setActive(view.kind === 'app' && id === view.appId);
    for (const [id, scope] of settingScopes) scope.setActive(view.kind === 'settings' && id === view.settingsId);
    options.onViewChange?.(view);
    if (view.kind === 'app' && announcedApp !== view.appId) {
      announcedApp = view.appId; options.onAppChange?.(view.appId);
    }
  }
  /** 显式宿主激活恢复业务；同 id 不重复通知应用切换，也不重建节点。 */
  function selectApp(id: string) {
    const route = menuProjection.value?.routes.get(id);
    if (route) {
      if (chrome.value && !chrome.value.requestApplication(id)) return;
      return openApplicationLink(route.applicationId, route.entryId);
    }
    if (destroyed) throw new Error("外壳已销毁");
    const linked = links.value.some((item) => item.id === id);
    if (!linked && !ids.has(id)) throw new Error(`未注册的应用：${id}`);
    // 宿主已激活当前软件时先撤下账户页面；资格未就绪仍由业务区遮罩保护。
    if (!linked && id === current.value) {
      chrome.value?.showApplication();
      if (openingApplication.value)
        return openApplicationLink(options.initialApp || options.apps[0]!.id);
      return;
    }
    if (chrome.value && !chrome.value.requestApplication(id)) return;
    if (linked) {
      chrome.value?.closeAccount();
      return openApplicationLink(id);
    }
    chrome.value?.showApplication();
    if (id === current.value) return;
    current.value = id;
  }
  const application = createApp({
    setup: () => () => {
      const index = options.apps.findIndex((app) => app.id === current.value);
      const app = options.apps[index]!;
      const actions = [
        ...(app.accountActions || []).map((action) => ({
          ...action,
          id: `app:${action.id}`,
          group: app.name,
        })),
        ...(options.commonActions || []).map((action) => ({
          ...action,
          id: `shell:${action.id}`,
          group: '账户与产品',
        })),
      ];
      return h(
        ShellChrome,
        {
          ref: chrome,
          logging,
          fileManagement: options.fileManagement,
          logScope: logScope.value,
          logRevision: logRevision.value,
          onLogViewChange: options.onLogViewChange,
          onClearLogScope: options.onClearLogScope,
          onViewChange: changeView,
          current: current.value,
          appName: app.name,
          openingApplication: openingApplication.value,
          applicationLinkIds: menuProjection.value ? [...menuProjection.value.routes.keys()] : links.value.map(item => item.id),
          applicationCatalog: !!applicationMenu.value,
          onApplicationLink: selectApp,
          sidebarMinWidth: app.sidebarMinWidth,
          sidebarFocused: sidebarFocused.value,
          theme: theme.value,
          options: menuProjection.value?.options || [...options.apps, ...links.value].map((item) => ({
            value: item.id,
            label: item.name,
            icon: item.icon,
            accessApplicationId: item.accessApplicationId,
            menuGroup: item.menuGroup,
          })),
          accountName: options.accountName,
          account: options.account,
          menu: actions,
          settingsSections: sections.filter(
            (section) => !section.appId || section.appId === current.value,
          ),
          onSettingsChange(id: string | null) {
            if (!id) {
              visitedSettings.clear();
              return;
            }
            if (visitedSettings.has(id)) return;
            const section = sections.find((section) => section.id === id);
            if (section?.onOpen) {
              visitedSettings.add(id);
              Promise.resolve()
                .then(section.onOpen)
                .catch((error) => {
                  visitedSettings.delete(id);
                  options.onError(error);
                });
            }
          },
          onThemeChange(value: ThemeName) {
            theme.value = value;
            options.onThemeChange?.(value);
          },
          customHelp: !!options.onHelp,
          onHelp() {
            Promise.resolve().then(options.onHelp).catch(options.onError);
          },
          windowHost: options.windowHost,
          onAppChange: selectApp,
          taskCart: options.taskCart ? { icon: options.taskCart.icon, failures: taskFailures.value } : undefined,
          onTaskCartOpen: () => Promise.resolve().then(() => options.taskCart?.onOpen?.()).catch(options.onError),
          onError: options.onError,
          async onAction(item) {
            try {
              await actions.find((action) => action.id === item.id)?.run();
            } catch (error) {
              options.onError(error);
            }
          },
        },
        {
          sidebarHeader: app.sidebarHeader ? () => h('slot', { name: `sidebar-header-${index}` }) : undefined,
          sidebar: () => h('slot', { name: `sidebar-${index}` }),
          main: () => h('slot', { name: `main-${index}` }),
          taskCart: options.taskCart?.content ? () => h('slot', { name: 'task-cart' }) : undefined,
          taskCartSidebar: options.taskCart?.sidebar ? () => h('slot', { name: 'task-cart-sidebar' }) : undefined,
          settings: ({ id }: { id: string }) =>
            h('slot', { name: `settings-${sections.findIndex((section) => section.id === id)}` }),
        },
      );
    },
  });
  const previousTheme = host.getAttribute('data-cxx-theme');
  const hadThemeClass = host.classList.contains('cxx-theme');
  host.classList.add('cxx-theme');
  const stopTheme = watch(theme, (value) => host.setAttribute('data-cxx-theme', value), {
    immediate: true,
    flush: 'sync',
  });
  const releaseIcons = installIconStates(host);
  /** 只恢复本壳持有的原生主题和图标状态。 */
  function releaseAppearance() {
    stopTheme();
    releaseIcons();
    if (previousTheme === null) host.removeAttribute('data-cxx-theme');
    else host.setAttribute('data-cxx-theme', previousTheme);
    if (!hadThemeClass) host.classList.remove('cxx-theme');
  }
  /** 释放外壳并恢复原生页面位置，创建失败与正常关闭使用相同出口。 */
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    openingRevision++;
    openingTasks.clear();
    shellScope.destroy();
    for (const scope of [...appScopes.values(), ...settingScopes.values()]) scope.destroy();
    releaseAppearance();
    application.unmount();
    restoreSlots();
    root.remove();
  }
  try {
    application.mount(root);
  } catch (error) {
    destroy();
    throw error;
  }
  return {
    selectApp,
    setApplicationLinks,
    setApplicationMenu,
    /** 恢复宿主确认的本地导航；资格遮罩保持独立生效，不触发选择时的商城跳转。 */
    restoreApplicationView(id: string) {
      if (!ids.has(id)) throw Error('宿主指定的应用功能不存在');
      chrome.value?.showApplication();
      current.value = id;
    },

    /** 同一页面更换业务对象时清理临时界面，不重建主页面。 */
    resetInteractions() { shellScope.reset(); },
    logging,
    /** 已挂载的左侧入口，供消息收取动画使用。 */
    getLogTarget: () => chrome.value?.getLogTarget(),
    setTaskFailureCount(value: number) { taskFailures.value = value; },
    /** 排序等侧栏交互期间暂停应用切换和账户操作。 */
    setSidebarFocus(active: boolean) { sidebarFocused.value = active; },
    /** 打开统一个人中心，保留当前业务页面与草稿。 */
    showAccount(target?: PersonalWorkspaceTarget) { chrome.value?.showAccount(target); },
    showSettingsPage(id?: string) {
      chrome.value?.showSettingsPage(id);
    },
    closeSettingsPage() {
      chrome.value?.closeSettingsPage();
    },
    showLogs(settings = false) {
      chrome.value?.showLogs(settings);
    },
    refreshLogs() {
      logRevision.value++;
    },
    setLogScope(scope?: LogScope) {
      logScope.value = scope;
    },
    setTheme(value: ThemeName) {
      theme.value = value;
    },
    destroy,
  };
}

/** 供同时消费旧版外壳的宿主判断独立任务车页面是否可用。 */
export namespace mountDomShell {
  export const supportsTaskCartView = true;
}

export { mountDomTitlebar } from './titlebar';
// 文件管理的原生入口：组合按钮与三个动作给业务 Renderer，引导框给打开动作复用。
export {
  FILE_MANAGE_ICONS,
  FILE_MANAGE_LABEL,
  OPEN_TOOL_REQUIRED,
  configureOpening,
  createFileManageActions,
  createFileManagerButton,
} from './file-management/index';
export type { FileManageActions, FileManageButtonOptions } from './file-management/index';

/** 外壳样式只进入自己的 ShadowRoot，业务样式无法覆盖窗口与账户控件。 */
function mountRoot(host: HTMLElement) {
  const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent =
    uiStyles + '\n' + titlebar + '\n' + shell + '\n' + logStyles + '\n' + settingsStyles + '\n' + accountStyles + '\n' + fileManageStyles;
  const root = document.createElement('div');
  shadow.replaceChildren(style, root);
  return root;
}

/** @deprecated 使用 createFileManagerButton。 */
export { createFileManagerButton as createFileManageButton } from './file-management/index';
