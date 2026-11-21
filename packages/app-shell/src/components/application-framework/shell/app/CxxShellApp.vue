<script setup lang="ts">
import { computed, ref, shallowRef, reactive, onMounted, onBeforeUnmount, watch } from 'vue';
import { createViewScope, type ViewScope } from '@cxx/ui/dom';
import { CxxMsgHost, useToasts, type ThemeName, type ThemeTokens, type MenuItem } from '@cxx/ui';
import ApplicationView from './internal/ApplicationView.vue';
import ShellChrome from './internal/ShellChrome.vue';
import ApplicationSettings from '../settings/internal/ApplicationSettings.vue';
import {
  createRuntime,
  validateApplications,
  type ApplicationModule,
  type RuntimeController,
  type ApplicationFeature,
} from '../../../../runtime';
import type { WindowHost, ShellAction, ShellView } from '../../../../types';
import type { PersonalAccountClient, PersonalWorkspaceTarget } from '../../../../account';
import { createMemoryLogClient, type LogClient } from '../../../../logging';
const props = withDefaults(
  defineProps<{
    apps: readonly ApplicationModule[];
    initialApp?: string;
    accountName?: string;
    account?: PersonalAccountClient;
    commonActions?: readonly ShellAction[];
    windowHost?: WindowHost;
    theme?: ThemeName;
    themeTokens?: ThemeTokens;
    logging?: LogClient;
    settingsSections?: readonly ApplicationFeature[];
  }>(),
  { accountName: 'cxx', commonActions: () => [], theme: 'dark' },
);
const emit = defineEmits<{
  appChange: [id: string];
  viewChange: [view: ShellView];
  error: [error: unknown];
  'update:theme': [theme: ThemeName];
}>();
const shellTheme = ref(props.theme);
watch(
  () => props.theme,
  (value) => {
    shellTheme.value = value;
  },
);
function changeTheme(value: ThemeName) {
  shellTheme.value = value;
  emit('update:theme', value);
}
validateApplications(props.apps);
const current = ref(
  props.apps.some((app) => app.id === props.initialApp) ? props.initialApp! : props.apps[0]!.id,
);
const app = computed(() => props.apps.find((item) => item.id === current.value)!);
const runtimes = new Map<string, RuntimeController>();
const logging = props.logging || createMemoryLogClient(props.apps);
const sidebar = ref<HTMLElement>();
const main = ref<HTMLElement>();
const runtime = shallowRef<RuntimeController>();
const chrome = ref<InstanceType<typeof ShellChrome>>();
let shellScope: ViewScope | undefined, pageScope: ViewScope | undefined;
let viewKey = '', pageActive = true;
const visitedApps = reactive(new Set<string>());
let announcedApp: string | undefined;
/** 组合版与原生版共用中央归属机制，切页一次收起所有临时控件。 */
function changeView(view: ShellView) {
  const key = `${view.kind}:${view.appId}:${view.settingsId || ''}`;
  if (key === viewKey) return;
  viewKey = key; pageActive = view.kind === 'app';
  shellScope?.reset(); pageScope?.setActive(pageActive);
  emit('viewChange', view);
  if (view.kind === 'app') {
    visitedApps.add(view.appId);
    if (announcedApp !== view.appId) { announcedApp = view.appId; emit('appChange', view.appId); }
  }
}
onMounted(() => {
  shellScope = createViewScope(chrome.value!.$el, { onError: report });
});
// 设置页会替换侧栏节点；归属跟随真实挂载节点，不能继续持有上一份侧栏。
watch([sidebar, main], ([side, content]) => {
  pageScope?.destroy(); pageScope = undefined;
  if (side && content) pageScope = createViewScope([side, content], { active: pageActive, onError: report });
}, { flush: 'post' });
defineExpose({ resetInteractions() { shellScope?.reset(); },
  showAccount(target?: PersonalWorkspaceTarget) { chrome.value?.showAccount(target); } });
watch(
  () => runtime.value?.feature,
  (id, previous) => {
    if (id) chrome.value?.showSettingsPage(`app:${id}`);
    else if (previous) chrome.value?.closeSettingsPage();
  },
  { flush: 'post' },
);
const { messages, push, dismiss } = useToasts();
function report(error: unknown) {
  push(error instanceof Error ? error.message : String(error), 'error');
  emit('error', error);
}
function activate() {
  runtime.value?.deactivate();
  let next = runtimes.get(current.value);
  if (!next) {
    next = createRuntime(app.value, report, logging);
    runtimes.set(current.value, next);
  }
  next.activate();
  runtime.value = next;
}
watch(current, activate, { immediate: true });
// 应用清单作为产品装配配置保持稳定；新增应用需重新装配外壳实例。
const options = computed(() =>
  props.apps.map((item) => ({ value: item.id, label: item.name, icon: item.icon,
    accessApplicationId: item.accessApplicationId, menuGroup: item.menuGroup })),
);
const featureMenu = computed<MenuItem[]>(() => [
  ...(app.value.accountActions || []).map((item) => ({
    ...item,
    id: `app:${item.id}`,
    group: app.value.name,
  })),
]);
const accountMenu = computed<MenuItem[]>(() =>
  props.commonActions.map((item) => ({ ...item, id: `shell:${item.id}`, group: '账户与产品' })),
);
const menu = computed(() => [...featureMenu.value, ...accountMenu.value]);
const settings = computed(() => [
  ...(props.settingsSections || []).map((item) => ({
    ...item,
    id: `product:${item.id}`,
    group: '公共设置',
  })),
  ...(app.value.settings || app.value.accountFeatures || []).map((item) => ({
    ...item,
    id: `app:${item.id}`,
    group: `${app.value.name}设置`,
  })),
]);
async function accountAction(item: MenuItem) {
  const selectedApp = app.value;
  const selectedRuntime = runtime.value!;
  try {
    if (item.id.startsWith('feature:')) {
      selectedRuntime.openFeature(item.id.slice('feature:'.length));
      return;
    }
    if (item.id.startsWith('shell:'))
      await props.commonActions.find((action) => `shell:${action.id}` === item.id)?.run();
    else
      await selectedApp.accountActions
        ?.find((action) => `app:${action.id}` === item.id)
        ?.run(selectedRuntime);
  } catch (error) {
    if (selectedRuntime.active) report(error);
  }
}
onBeforeUnmount(() => {
  shellScope?.destroy(); pageScope?.destroy();
  runtimes.forEach((session) => session.deactivate());
});
</script>
<template>
  <ShellChrome
    ref="chrome"
    :current="current"
    :options="options"
    :app-name="app.name"
    :sidebar-min-width="app.sidebarMinWidth"
    :account-name="accountName"
    :account="account"
    :menu="menu"
    :theme="shellTheme"
    :theme-tokens="themeTokens"
    :window-host="windowHost"
    :logging="logging"
    :settings-sections="settings"
    @theme-change="changeTheme"
    @view-change="changeView"
    @settings-change="!$event && runtime?.openFeature(null)"
    @app-change="current = $event"
    @action="accountAction"
    @error="report"
  >
    <template #sidebar><div ref="sidebar" class="cxx-shell-region-mount" /></template>
    <template #main><div ref="main" class="cxx-shell-region-mount" /></template>
    <template #settings="{ id }">
      <ApplicationSettings
        v-for="entry in settings.filter((item) => item.id === id)"
        :key="`${current}:${entry.id}`"
        :section="entry"
        :runtime="runtime!"
        :styles="app.styles"
      />
    </template>
    <ApplicationView
      v-if="sidebar && main && runtime && visitedApps.has(current)"
      :key="current"
      :app="app"
      :runtime="runtime"
      :sidebar="sidebar"
      :main="main"
    />
    <CxxMsgHost :messages="messages" @dismiss="dismiss" />
  </ShellChrome>
</template>
