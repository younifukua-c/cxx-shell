<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { CxxButton, CxxInput, CxxSelect, CxxPagination } from '@cxx/ui';
import LogSettings from './internal/LogSettings.vue';
import type { LogApplication, LogClient, LogEntry, LogLevel } from '../../../../logging';
export interface LogScope {
  appId: string;
  label: string;
  scopes: string[];
}
const props = defineProps<{
  client: LogClient;
  current: string;
  settings?: boolean;
  revision?: number;
  scope?: LogScope;
}>();
const emit = defineEmits<{ close: []; settings: []; clearScope: []; error: [error: unknown] }>();
const apps = ref<readonly LogApplication[]>([]),
  entries = ref<LogEntry[]>([]);
const results = ref<HTMLElement>();
const searchDraft = ref('');
const appId = ref(props.current),
  type = ref(''),
  level = ref(''),
  search = ref('');
const page = ref(1),
  total = ref(0),
  busy = ref(false),
  error = ref('');
const PAGE_SIZE = 100;
const SEARCH_DELAY_MS = 200;
let searchTimer: ReturnType<typeof setTimeout> | undefined;
let catalogRequest: ReturnType<LogClient['catalog']> | undefined;
let displayedQuery = '';
let request = 0,
  alive = true;
const app = computed(() => apps.value.find((item) => item.id === appId.value));
const appOptions = computed(() => [
  { value: '', label: '全部应用日志' },
  ...apps.value.map((item) => ({ value: item.id, label: `${item.name}日志` })),
]);
const typeOptions = computed(() => [
  { value: '', label: '全部类型' },
  ...(app.value?.logTypes || []).map((item) => ({ value: item.id, label: item.label })),
]);
const statusOptions = [
  { value: '', label: '全部状态' },
  { value: 'info', label: '成功 / 信息' },
  { value: 'warning', label: '警告' },
  { value: 'error', label: '失败' },
];
const activeScope = computed(() => (props.scope?.appId === appId.value ? props.scope : undefined));
const scopeValues = computed(() =>
  activeScope.value ? [...new Set(activeScope.value.scopes)].sort() : undefined,
);
const filterKey = computed(() =>
  JSON.stringify([appId.value, type.value, level.value, search.value, scopeValues.value]),
);
function typeLabel(entry: LogEntry) {
  return (
    apps.value.find((a) => a.id === entry.appId)?.logTypes?.find((t) => t.id === entry.type)
      ?.label || entry.type
  );
}
async function load() {
  const ticket = ++request;
  busy.value = true;
  error.value = '';
  try {
    const catalog = await (catalogRequest ||= props.client.catalog());
    if (!alive || ticket !== request) return;
    apps.value = catalog;
    if (props.settings) return;
    const query = {
      appId: appId.value,
      type: type.value,
      level: (level.value || undefined) as LogLevel | undefined,
      search: search.value,
      scopes: scopeValues.value,
      offset: (page.value - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
    };
    const key = JSON.stringify(query);
    if (key !== displayedQuery) {
      entries.value = [];
      total.value = 0;
      if (results.value) results.value.scrollTop = 0;
    }
    const result = await props.client.list(query);
    if (alive && ticket === request) {
      displayedQuery = key;
      entries.value = result.items;
      total.value = result.total;
    }
  } catch (reason) {
    if (alive && ticket === request) {
      if (!apps.value.length) catalogRequest = undefined;
      error.value = reason instanceof Error ? reason.message : String(reason);
    }
  } finally {
    if (alive && ticket === request) busy.value = false;
  }
}
function refresh() {
  clearTimeout(searchTimer);
  if (!props.settings && search.value !== searchDraft.value) {
    search.value = searchDraft.value;
    return;
  }
  void load();
}
watch(appId, () => {
  type.value = '';
});
watch(searchDraft, (value) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    search.value = value;
  }, SEARCH_DELAY_MS);
});
watch(
  () => props.current,
  (value) => {
    appId.value = value;
  },
);
watch(
  () => props.client,
  () => {
    catalogRequest = undefined;
    displayedQuery = '';
    entries.value = [];
    total.value = 0;
  },
);
watch(filterKey, () => {
  page.value = 1;
});
watch([filterKey, page, () => props.settings, () => props.revision, () => props.client], load, {
  immediate: true,
});
onBeforeUnmount(() => {
  alive = false;
  request++;
  clearTimeout(searchTimer);
});
</script>
<template>
  <section
    class="cxx-log-center"
    :data-view="settings ? 'settings' : 'logs'"
    :aria-label="settings ? '日志设置' : '应用日志'"
  >
    <header class="cxx-log-heading">
      <h2>{{ settings ? '日志设置' : '应用日志' }}</h2>
      <div class="cxx-row">
        <CxxButton
          v-if="!settings"
          :help="{ purpose: '配置日志保留时间、记录类型与保存目录' }"
          @click="$emit('settings')"
        >
          日志设置
        </CxxButton>
        <CxxButton :help="{ purpose: '关闭日志页，返回当前应用' }" @click="$emit('close')">
          返回应用
        </CxxButton>
      </div>
    </header>
    <p v-if="settings && error" role="alert">
      {{ error }}
      <CxxButton
        :disabled="busy"
        :help="{
          purpose: '重新读取日志',
          unavailableReason: busy ? '日志正在读取，请稍候' : undefined,
        }"
        @click="refresh"
      >
        重试
      </CxxButton>
    </p>
    <LogSettings
      v-if="settings && apps.length"
      :client="client"
      :apps="apps"
      @error="$emit('error', $event)"
    />
    <template v-else-if="!settings">
      <div class="cxx-log-filters" role="search" aria-label="日志筛选">
        <CxxSelect v-if="apps.length > 1" v-model="appId" label="日志应用" :options="appOptions" />
        <CxxSelect
          v-model="type"
          label="日志类型"
          :options="typeOptions"
          :disabled="!appId"
          :title="!appId ? '选择一个应用后可筛选日志类型' : undefined"
        />
        <CxxSelect v-model="level" label="日志状态" :options="statusOptions" />
        <div class="cxx-log-search">
          <CxxInput
            v-model="searchDraft"
            label="搜索日志"
            label-hidden
            placeholder="搜索内容、资源或详情"
          />
        </div>
        <CxxButton
          :disabled="busy"
          :help="{
            purpose: '刷新当前筛选条件的日志，保留滚动位置',
            unavailableReason: busy ? '日志正在读取，请稍候' : undefined,
          }"
          @click="refresh"
        >
          刷新日志
        </CxxButton>
      </div>
      <div
        ref="results"
        class="cxx-log-results"
        role="region"
        aria-label="日志记录"
        :aria-description="activeScope?.label"
        tabindex="0"
        :aria-busy="busy"
      >
        <p v-if="!busy && !entries.length && !error" class="cxx-log-empty">暂无匹配的应用日志</p>
        <ol class="cxx-log-list" :aria-busy="busy">
          <li
            v-for="entry in entries"
            :key="entry.id"
            class="cxx-log-entry"
            :data-level="entry.level"
          >
            <time :datetime="new Date(entry.ts).toISOString()">
              {{ new Date(entry.ts).toLocaleString() }}
            </time>
            <span>
              {{ apps.find((item) => item.id === entry.appId)?.name || entry.appId }} ·
              {{ typeLabel(entry) }}
            </span>
            <strong>
              {{ entry.level === 'error' ? '失败' : entry.level === 'warning' ? '警告' : '信息' }}
            </strong>
            <p>{{ entry.message }}</p>
            <p v-if="entry.scope" class="cxx-muted">{{ entry.scope }}</p>
            <details v-if="entry.details">
              <summary>详情</summary>
              <pre>{{ entry.details }}</pre>
            </details>
          </li>
        </ol>
      </div>
      <footer class="cxx-log-footer">
        <div v-if="error" class="cxx-log-error" role="alert">
          {{ error }}
          <CxxButton
            :disabled="busy"
            :help="{
              purpose: '重试读取当前日志',
              unavailableReason: busy ? '日志正在读取，请稍候' : undefined,
            }"
            @click="refresh"
          >
            重试
          </CxxButton>
        </div>
        <p v-else role="status" aria-live="polite">
          {{ busy ? '正在读取日志…' : '' }}
        </p>
        <CxxPagination
          v-model="page"
          :total="total"
          :page-size="PAGE_SIZE"
          :disabled="busy"
          :title="busy ? '日志正在读取，完成后可翻页' : undefined"
        />
      </footer>
    </template>
  </section>
</template>
