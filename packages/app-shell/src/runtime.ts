import { reactive, ref, inject, type InjectionKey, type Component } from 'vue';
import type { MenuItem } from '@cxx/ui';
import { isReservedApplicationId, validateApplicationMenuGroup, type ApplicationMenuGroup } from './application-entry';
import { createMemoryLogClient, type LogClient, type LogInput, type LogType } from './logging';
/** 接入应用的独立会话。状态生命周期属于外壳实例，不跨产品实例共享。 */
export interface AppRuntime<S extends object = object> {
  readonly id: string;
  readonly state: S;
  readonly active: boolean;
  /** 写入本应用日志；宿主失败会 reject，调用方须处理。 */
  recordLog(entry: Omit<LogInput, 'appId'>): ReturnType<LogClient['record']>;
  /** 当前内置功能 id；null 表示应用主页面。 */
  readonly feature: string | null;
  /** 打开所属应用注册的功能，传 null 返回主页面。 */
  openFeature(id: string | null): void;
  /** 同名读取采用最后一次结果；退出应用时中止并丢弃旧结果。业务读取必须遵循 signal。 */
  runLatest<T>(
    key: string,
    load: (signal: AbortSignal) => Promise<T>,
    commit: (result: T) => void,
  ): Promise<boolean>;
}
export interface AccountAction extends MenuItem {
  /** 应用专属动作只接收所属应用的运行会话。 */
  run(runtime: AppRuntime): void | Promise<void>;
}
/** 设置页中的应用配置页，与主页面共享本应用会话和主题。 */
export interface ApplicationFeature {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  component: Component;
}
/** 外壳只认识应用身份与入口，不认识项目或业务存储。 */
export interface ApplicationModule {
  id: string;
  name: string;
  icon?: string;
  /** 默认使用本模块 id；string 映射真实软件，null 显式声明公共页面。 */
  accessApplicationId?: string | null;
  /** 同组有多个入口时，由外壳显示为级联菜单。 */
  menuGroup?: ApplicationMenuGroup;
  sidebar?: Component;
  /** 侧栏可拖至的最小宽度；图标导航可传 72，普通内容默认 180。 */
  sidebarMinWidth?: number;
  page: Component;
  createState(): object;
  /** 仅注入本应用 Shadow DOM；公共视觉由 @cxx/ui 提供。 */
  styles?: string;
  accountActions?: readonly AccountAction[];
  accountFeatures?: readonly ApplicationFeature[];
  /** 当前应用在设置页提供的页面；优先于旧 accountFeatures。 */
  settings?: readonly ApplicationFeature[];
  logTypes?: readonly LogType[];
}
export interface RuntimeController extends AppRuntime {
  activate(): void;
  deactivate(): void;
  scroll: { sidebar: number; main: number };
}
const runtimeKey: InjectionKey<AppRuntime> = Symbol('cxx-application');
export { runtimeKey };
export function useApplication<S extends object>(): AppRuntime<S> {
  const runtime = inject(runtimeKey);
  if (!runtime) throw new Error('useApplication 必须在 CxxShellApp 的应用组件中调用');
  return runtime as AppRuntime<S>;
}
/** 在本外壳内创建隔离状态、请求序号和取消控制器。 */
export function createRuntime(
  module: ApplicationModule,
  onError: (error: unknown) => void,
  logging: LogClient = createMemoryLogClient([module]),
): RuntimeController {
  const state = reactive(module.createState());
  const tasks = new Map<string, AbortController>();
  const feature = ref<string | null>(null);
  let active = false;
  return {
    id: module.id,
    recordLog: (entry) => logging.record({ ...entry, appId: module.id }),
    state,
    scroll: { sidebar: 0, main: 0 },
    get feature() {
      return feature.value;
    },
    openFeature(id) {
      if (!active) return;
      if (
        id !== null &&
        !(module.settings || module.accountFeatures)?.some((item) => item.id === id)
      )
        throw new Error(`未注册的应用功能：${id}`);
      feature.value = id;
    },
    get active() {
      return active;
    },
    activate() {
      active = true;
    },
    deactivate() {
      active = false;
      tasks.forEach((controller) => controller.abort());
      tasks.clear();
    },
    async runLatest(key, load, commit) {
      if (!active) return false;
      tasks.get(key)?.abort();
      const controller = new AbortController();
      tasks.set(key, controller);
      try {
        const result = await load(controller.signal);
        if (!active || controller.signal.aborted || tasks.get(key) !== controller) return false;
        commit(result);
        return true;
      } catch (error) {
        if (active && !controller.signal.aborted && tasks.get(key) === controller) {
          onError(error);
          try {
            await logging.record({
              appId: module.id,
              type: 'error',
              level: 'error',
              message: `读取失败：${key}`,
              details: error instanceof Error ? error.message : String(error),
            });
          } catch (logError) {
            onError(logError);
          }
        }
        return false;
      } finally {
        if (tasks.get(key) === controller) tasks.delete(key);
      }
    },
  };
}
/** 入口注册时立即拒绝重复 id，避免状态与菜单串用。 */
export function validateApplications(modules: readonly ApplicationModule[]) {
  if (!modules.length) throw new Error('至少需要一个应用');
  const ids = new Set<string>();
  const groups = new Map<string, ApplicationMenuGroup>();
  for (const app of modules) {
    validateApplicationMenuGroup(app.menuGroup, groups);
    if (app.accessApplicationId != null && (typeof app.accessApplicationId !== 'string' || !app.accessApplicationId.trim()))
      throw new Error('软件资格标识不能为空');
    if (!app.id || isReservedApplicationId(app.id) || !app.name || ids.has(app.id))
      throw new Error(`应用 id 为空或重复：${app.id}`);
    ids.add(app.id);
    const features = new Set<string>();
    for (const feature of app.settings || app.accountFeatures || []) {
      if (!feature.id || !feature.label || features.has(feature.id))
        throw new Error(`应用功能 id 为空或重复：${feature.id}`);
      features.add(feature.id);
    }
  }
}
