<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, nextTick, toRef, useSlots } from 'vue';
import { installTooltips } from '@cxx/ui/dom';
import LogCenter, { type LogScope } from '../../../log/center/CxxLogCenter.vue';
import { createMemoryLogClient, type LogClient } from '../../../../../logging';
import type { FileManageClient } from '../../../../../file-management/index';
import {
  CxxCascader,
  CxxLoadingSkeletonBoard,
  CxxLoadingSkeletonTree,
  themeVariables,
  provideIconSkin,
  type MenuItem,
  type ThemeName,
  type ThemeTokens,
} from '@cxx/ui';
import WindowTitlebar from './WindowTitlebar.vue';
import { useSidebarResize, sidebarMinimumWidth } from './use-sidebar-resize';
import settingsIcon from '@cxx/icons/assets/01-settings.svg';
import logIcon from '@cxx/icons/assets/24-log.svg';
import appIcon from '@cxx/icons/assets/38-workspace.svg';
import lockIcon from '@cxx/icons/assets/security-lock.svg';
import SettingsCenter from '../../settings/CxxShellSettings.vue';
import SettingsNav from '../../settings/internal/SettingsNav.vue';
import ShellSettingsPage from './ShellSettingsPage.vue';
import { shellSettingsItems } from './shell-settings';
import ApplicationAccessPrompt from '../../account/ApplicationAccessPrompt.vue';
import type { SettingsItem } from '../../../../../settings';
import helpIcon from '@cxx/icons/assets/02-help.svg';
import type { ShellView, WindowHost } from '../../../../../types';
import { LOGS_ID, SETTINGS_ID, TASK_CART_ID } from '../../../../../application-entry';
import type { PersonalAccountClient, PersonalWorkspaceTarget } from '../../../../../account';
import PersonalWorkspacePanel from '../../account/PersonalWorkspacePanel.vue';
import ShellAccountMenu from '../../account/ShellAccountMenu.vue';
import { personalAccountMenu, personalAccountDestination } from '../../account/account-menu';
import PersonalWorkspaceNavigation from '../../account/PersonalWorkspaceNavigation.vue';
import { observeShellNavigation, useShellNavigation } from './use-shell-navigation';
import { usePersonalAccount } from '../../account/use-personal-account';
import { groupSwitcherOptions, shellUtilityOptions, type ApplicationSwitcherOption } from './application-switcher';
let stopTooltips: (() => void) | undefined;
onMounted(() => { stopTooltips = installTooltips(document); });
onBeforeUnmount(() => stopTooltips?.());
const props = withDefaults(
  defineProps<{
    current: string;
    applicationLinkIds?: readonly string[];
    applicationCatalog?: boolean;
    options: readonly ApplicationSwitcherOption[];
    appName: string;
    openingApplication?: string;
    sidebarMinWidth?: number;
    sidebarFocused?: boolean;
    accountName?: string;
    account?: PersonalAccountClient;
    menu: readonly MenuItem[];
    theme?: ThemeName;
    themeTokens?: ThemeTokens;
    windowHost?: WindowHost;
    logging?: LogClient;
    taskCart?: { icon?: string; failures: number };
    logScope?: LogScope;
    logRevision?: number;
    /** 文件管理能力的宿主实现；不传就不出现「文件夹与打开方式」这一页。 */
    fileManagement?: FileManageClient;
    settingsSections?: readonly SettingsItem[];
    customHelp?: boolean;
  }>(),
  { accountName: 'cxx', theme: 'dark' },
);
const emit = defineEmits<{
  appChange: [id: string];
  applicationLink: [id: string];
  action: [item: MenuItem];
  error: [error: unknown];
  logViewChange: [open: boolean];
  taskCartOpen: [];
  clearLogScope: [];
  themeChange: [theme: ThemeName];
  settingsChange: [id: string | null];
  help: [];
  viewChange: [view: ShellView];
}>();
provideIconSkin(computed(() => props.theme));
const navigation = useShellNavigation();
const slots = useSlots();
const { view, settingsPage, section, accountTarget, accountHelp } = navigation;
const currentAccessId = computed(() => {
  const mapped = props.options.find((item) => item.value === props.current)?.accessApplicationId;
  return mapped === undefined ? props.current : mapped;
});
const accountRequired = computed(() =>
  props.options.some(
    (item) => item.value === props.current && item.accessApplicationId !== undefined,
  ),
);
const accountState = usePersonalAccount(toRef(props, 'account'), currentAccessId, accountRequired);
const personal = ref<InstanceType<typeof PersonalWorkspacePanel>>();
const displayAccountName = computed(() => accountState.name.value || '未登录');
const helpOpen = ref(false);
const layout = ref<HTMLElement>(), sidebar = ref<HTMLElement>(), main = ref<HTMLElement>();
const sidebarKey = computed(() =>
  view.value === 'account'
    ? 'personal'
    : settingsPage.value
      ? 'settings'
      : view.value || `app:${props.current}`,
);
const minimum = computed(() =>
  sidebarMinimumWidth(navigation.surface.value.kind, props.sidebarMinWidth),
);
const compact = useSidebarResize(layout, sidebar, main, sidebarKey, minimum);
observeShellNavigation(navigation, () => props.current, () => accountState.blocked.value, {
  viewChange: value => emit('viewChange', value),
  logViewChange: open => emit('logViewChange', open),
  settingsChange: id => emit('settingsChange', id),
});
const settingsItems = computed(() =>
  shellSettingsItems(props.settingsSections || [], props.menu, !!props.fileManagement),
);
const fallback = createMemoryLogClient(
  props.options.map((item) => ({ id: item.value, name: item.label })),
);
const client = computed(() => props.logging || fallback);
const switchOptions = computed(() => [
  ...groupSwitcherOptions(props.options.map((item) => {
    const status = accountState.access(
      item.accessApplicationId === undefined ? item.value : item.accessApplicationId,
      item.accessApplicationId !== undefined,
    );
    return {
      ...item,
      icon: item.icon || appIcon,
      trailingIcon: status.allowed ? undefined : lockIcon,
      trailingLabel: status.allowed ? undefined : `需要解锁。${status.message}`,
    };
  })),
  ...shellUtilityOptions(logIcon, settingsIcon, props.taskCart, props.applicationCatalog),
]);
/** 登录账户提供个人入口，设置仍由统一视图承载。 */
const accountItems = computed(() =>
  personalAccountMenu(props.account, accountState.authenticated.value, appIcon, helpIcon),
);
function settingsChanged(id: string) {
  if (id.startsWith('action:')) {
    navigation.showApplication();
    const item = props.menu.find((item) => `action:${item.id}` === id);
    if (item) emit('action', item);
  } else emit('settingsChange', id);
}
function showLogs(settings = false) {
  if (settings) return showSettingsPage('common:logs');
  navigation.showLogs();
}
function closeLogs() {
  if (view.value === 'logs') navigation.showApplication();
}
/** 应用设置只属于应用工作区，不作为个人导航容器。 */
function showSettingsPage(id?: string) {
  navigation.showSettings(id);
}
function closeSettingsPage() {
  if (settingsPage.value) navigation.showApplication();
}
/** 显式激活业务视图；同一应用 id 也必须退出个人区。 */
function showApplication() {
  navigation.showApplication();
}
/** 外部应用入口退出个人页，保留已有设置和日志的失败恢复合同。 */
function closeAccount() {
  if (view.value === 'account') showApplication();
}
/** 锁定选择只进入既有商城入口，不发普通应用或外链切换事件。 */
function requestApplication(id: string) {
  const item = props.options.find((item) => item.value === id);
  if (!item) return false;
  const applicationId =
    item.accessApplicationId === undefined ? item.value : item.accessApplicationId;
  if (
    applicationId === null ||
    accountState.access(applicationId, item.accessApplicationId !== undefined).allowed
  )
    return true;
  showAccount({ page: 'store', applicationId });
  return false;
}
/** 选择器模型保持受控；导航仅由 select 事件确认，外链或拒绝不改写当前标签。 */
function retainNavigationSelection() {}
function selectApp(id: string) {
  if (id === LOGS_ID) return showLogs();
  if (id === TASK_CART_ID && props.taskCart) {
    if (slots.taskCart) navigation.showTaskCart();
    return emit('taskCartOpen');
  }
  if (id === SETTINGS_ID) return showSettingsPage();
  if (!requestApplication(id)) return;
  if (props.applicationLinkIds?.includes(id)) {
    closeAccount();
    emit('applicationLink', id);
    return;
  }
  showApplication();
  emit('appChange', id);
}
/** 返回仅恢复页面，资格重新读取，不能把历史返回位置作为授权。 */
function returnToApplication() {
  void accountState.revalidate();
  navigation.returnToApplication();
}
function action(item: MenuItem) {
  if (item.id === 'cxx:help' && view.value === 'account') {
    navigation.showAccount({ page: 'help' });
    return;
  }
  const destination = personalAccountDestination(
    item.id,
    props.account,
    accountState.authenticated.value,
  );
  if (destination) return showAccount(destination.target);
  if (props.customHelp) emit('help');
  else helpOpen.value = true;
}
/** 宿主将可恢复的账户状态引导到统一入口，不重建当前业务页面。 */
function showAccount(target?: PersonalWorkspaceTarget) {
  if (!props.account) return;
  navigation.showAccount(target);
  if (!props.account.workspace && target?.page === 'store')
    void nextTick(() => personal.value?.openStore(target.applicationId));
}
const logTarget = ref<HTMLElement>();
defineExpose({
  requestApplication,
  showApplication,
  closeAccount,
  showAccount,
  showLogs,
  closeLogs,
  showSettingsPage,
  closeSettingsPage,
  getLogTarget: () => logTarget.value,
});
</script>
<template>
  <div class="cxx-shell cxx-theme" :data-cxx-theme="theme" :style="themeVariables(themeTokens)">
    <WindowTitlebar :window-host="windowHost" @error="$emit('error', $event)" />
    <div ref="layout" class="cxx-shell-layout" data-cxx-dialog-boundary>
      <aside
        ref="sidebar"
        class="cxx-shell-sidebar"
        :data-compact="compact || undefined"
        :data-personal="view === 'account' || undefined"
        :aria-label="view === 'account' ? '个人工作区侧栏' : '应用侧栏'"
      >
        <PersonalWorkspaceNavigation
          v-if="view === 'account'"
          :items="accountItems"
          :selected-item="accountHelp ? 'cxx:help' : undefined"
          :target="accountTarget"
          :compact="compact"
          @back="returnToApplication"
          @select="action"
        />
        <div v-show="view !== 'account'" class="cxx-shell-switch" :inert="sidebarFocused">
          <div ref="logTarget">
            <CxxCascader
              :model-value="view === 'task-cart' ? TASK_CART_ID : view === 'logs' ? LOGS_ID : settingsPage ? SETTINGS_ID : current"
              @update:model-value="retainNavigationSelection"
              @select="selectApp"
              label="切换应用"
              placeholder="选择应用"
              max-list-height="available"
              :compact="compact"
              :badge="taskCart?.failures"
              :options="switchOptions"
            />
          </div>
          <slot v-if="!view && !settingsPage && !accountState.blocked.value && !openingApplication" name="sidebarHeader" />
        </div>
        <div v-show="view !== 'account'" class="cxx-shell-business-sidebar">
          <div v-if="openingApplication && !view && !settingsPage" class="cxx-shell-opening-sidebar" aria-busy="true">
            <CxxLoadingSkeletonTree :rows="8" label="正在加载应用导航" />
          </div>
          <div
            v-if="!settingsPage"
            v-show="view !== 'account' && view !== 'task-cart' && !accountState.blocked.value && !openingApplication"
            :inert="accountState.blocked.value"
            style="display: contents"
          >
            <slot name="sidebar" />
          </div>
          <slot v-if="view === 'task-cart'" name="taskCartSidebar" />
          <SettingsNav
            v-if="settingsPage"
            v-model="section"
            :items="settingsItems"
            :compact="compact"
            @update:model-value="settingsChanged"
          />
        </div>
        <ShellAccountMenu
          v-show="view !== 'account'"
          :key="current"
          :inert="sidebarFocused"
          :name="displayAccountName"
          :items="accountItems"
          trigger-class="cxx-hover-float"
          @select="action"
        />
      </aside>
      <main
        ref="main"
        class="cxx-shell-main"
        :data-personal="view === 'account' || undefined"
        :aria-label="view === 'account' ? '个人工作区' : appName"
        data-cxx-drawer-boundary
      >
        <section v-if="openingApplication && !view && !settingsPage"
          class="cxx-shell-opening-main" aria-busy="true">
          <CxxLoadingSkeletonBoard :cards="3" :lines="4" :label="'正在打开' + openingApplication" />
        </section>
        <div
          v-show="!view && !settingsPage && !accountState.blocked.value && !openingApplication"
          class="cxx-shell-main-content"
        >
          <slot name="main" />
        </div>
        <ApplicationAccessPrompt
          v-if="!view && !settingsPage && accountState.blocked.value && !openingApplication"
          :message="accountState.message.value"
          :has-account="!!account"
          :show-renew="!!account && accountState.recovery.value === 'store'"
          @personal="
            showAccount(
              account?.workspace && !accountState.authenticated.value
                ? { page: 'login' }
                : undefined,
            )
          "
          @renew="requestApplication(current)"
          @retry="accountState.refresh"
        />
        <PersonalWorkspacePanel
          v-if="view === 'account' && account"
          ref="personal"
          :client="account"
          :theme="theme"
          :target="accountTarget"
          :help="accountHelp"
          @navigate="showAccount"
        />
        <div v-if="taskCart && $slots.taskCart" v-show="view === 'task-cart'" class="cxx-shell-main-content">
          <slot name="taskCart" />
        </div>
        <LogCenter
          v-if="navigation.applicationSurface.value.kind === 'logs'"
          v-show="view === 'logs'"
          :client="client"
          :current="current"
          :revision="logRevision"
          :scope="logScope"
          @close="closeLogs"
          @settings="showSettingsPage('common:logs')"
          @clear-scope="$emit('clearLogScope')"
          @error="$emit('error', $event)"
        />
        <ShellSettingsPage
          v-if="navigation.applicationSurface.value.kind === 'settings'"
          v-show="settingsPage"
          v-model="section"
          :items="settingsItems"
          :theme="theme"
          :current="current"
          :client="client"
          :file-management="fileManagement"
          @update:model-value="settingsChanged"
          @theme-change="$emit('themeChange', $event)"
          @error="$emit('error', $event)"
        >
          <template #default="{ id }"><slot name="settings" :id="id" /></template>
        </ShellSettingsPage>
      </main>
    </div>
    <SettingsCenter
      v-model:open="helpOpen"
      title="帮助"
      :items="[{ id: 'guide', label: '使用帮助' }]"
    >
      <p>通过左上角切换应用或查看应用日志。</p>
      <p>应用设置从左上角下拉进入：左侧选择选项，右侧修改内容；切回应用即退出设置。</p>
    </SettingsCenter>
    <slot />
  </div>
</template>
