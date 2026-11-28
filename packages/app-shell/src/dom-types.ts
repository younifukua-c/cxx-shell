import type {ThemeName} from '@cxx/ui';
import type {SettingsItem} from './settings';
import type {LogClient, LogType} from './logging';
import type {FileManageClient} from './file-management/index';
import type {ShellAction, ShellView, WindowHost} from './types';
import type {ApplicationMenuGroup} from './application-entry';
import type {PersonalAccountClient, PersonalWorkspaceTarget} from './account';

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

