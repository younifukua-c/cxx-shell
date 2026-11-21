import { computed, shallowRef, watch } from 'vue';
import type { ShellView } from '../../../../../types';
import type { PersonalWorkspaceTarget } from '../../../../../personal-workspace';

/** 应用工作区内可恢复的页面；不包含临时个人页面。 */
type ApplicationSurface = { kind: 'app' } | { kind: 'logs' } | { kind: 'task-cart' } | { kind: 'settings'; id: string };
/** 个人区保留单一返回位置；切换个人菜单保留应用返回位置。 */
type ShellSurface =
  | ApplicationSurface
  | {
      kind: 'account';
      target?: PersonalWorkspaceTarget | { page: 'help' };
      returnTo: ApplicationSurface;
    };

/** 唯一的外壳页面状态；权限结果只决定内容能否显示，不负责改写导航。 */
export function useShellNavigation() {
  const surface = shallowRef<ShellSurface>({ kind: 'app' });
  let lastSettings = 'common:appearance';
  const view = computed(() =>
    surface.value.kind === 'app' || surface.value.kind === 'settings' ? null : surface.value.kind,
  );
  const settingsPage = computed(() => surface.value.kind === 'settings');
  const applicationSurface = computed(() =>
    surface.value.kind === 'account' ? surface.value.returnTo : surface.value,
  );
  const accountTarget = computed(() =>
    surface.value.kind === 'account' && surface.value.target?.page !== 'help'
      ? surface.value.target
      : undefined,
  );
  const accountHelp = computed(
    () => surface.value.kind === 'account' && surface.value.target?.page === 'help',
  );
  const section = computed({
    get: () => (surface.value.kind === 'settings' ? surface.value.id : lastSettings),
    set: (id: string) => {
      if (surface.value.kind === 'settings') showSettings(id);
    },
  });
  /** 显式打开业务页面，同一软件再次激活也必须撤下个人区。 */
  function showApplication() {
    surface.value = { kind: 'app' };
  }
  /** 打开应用日志，不改变业务节点或草稿。 */
  function showLogs() {
    surface.value = { kind: 'logs' };
  }
  /** 打开任务车，保留应用、消息与设置页节点。 */
  function showTaskCart() {
    surface.value = { kind: 'task-cart' };
  }
  /** 打开应用设置，并记住最近选中的设置项。 */
  function showSettings(id = lastSettings) {
    lastSettings = id;
    surface.value = { kind: 'settings', id };
  }
  /** 进入或切换个人页面；始终保留首次进入前的工作区。 */
  function showAccount(target?: PersonalWorkspaceTarget | { page: 'help' }) {
    const previous = surface.value;
    surface.value = {
      kind: 'account',
      target,
      returnTo: previous.kind === 'account' ? previous.returnTo : previous,
    };
  }
  /** 返回应用工作区；内容显示仍由当前权限判定，不能恢复旧授权。 */
  function returnToApplication() {
    if (surface.value.kind === 'account') surface.value = surface.value.returnTo;
  }
  return {
    surface: computed(() => surface.value),
    view,
    settingsPage,
    applicationSurface,
    section,
    accountTarget,
    accountHelp,
    showApplication,
    showLogs,
    showTaskCart,
    showSettings,
    showAccount,
    returnToApplication,
  };
}

/** 外壳按页面切换发布进入与退出事件，资格变化只影响当前显示的页面。 */
export function observeShellNavigation(
  navigation: ReturnType<typeof useShellNavigation>,
  current: () => string,
  blocked: () => boolean,
  events: {
    viewChange: (view: ShellView) => void;
    logViewChange: (open: boolean) => void;
    settingsChange: (id: string | null) => void;
  },
) {
  const { view, settingsPage, section, surface } = navigation;
  watch(
    [current, view, settingsPage, section, blocked],
    ([appId, page, settings, settingsId, locked]) => events.viewChange({
      kind: settings ? 'settings' : page || (locked ? 'account' : 'app'),
      appId,
      settingsId: settings ? settingsId : undefined,
    }),
    { immediate: true, flush: 'sync' },
  );
  watch(surface, (next, previous) => {
    if ((next.kind === 'logs') !== (previous.kind === 'logs'))
      events.logViewChange(next.kind === 'logs');
    if (next.kind === 'settings' && (previous.kind !== 'settings' || previous.id !== next.id))
      events.settingsChange(next.id);
    else if (previous.kind === 'settings' && next.kind !== 'settings')
      events.settingsChange(null);
  }, { flush: 'sync' });
}
