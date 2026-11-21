<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { CxxButton, CxxCategoryMenuGroup, CxxCheckbox, CxxForm, CxxFormField, CxxInput, CxxInputPath, CxxPanelForm } from '@cxx/ui';
import confirmDefault from '@cxx/icons/assets/97-confirm.svg';
import confirmHover from '@cxx/icons/assets/97-confirm-hover.svg';
import confirmActive from '@cxx/icons/assets/97-confirm-active.svg';
import confirmDisabled from '@cxx/icons/assets/97-confirm-disabled.svg';
import type { LogApplication, LogClient, LogSettings, LogType } from '../../../../../logging';
import type { GroupMenuGroup } from '@cxx/ui';
import { LOG_ENTRY_LIMIT } from '../../../../../logging';
import { LOG_RETENTION_DAYS_LIMIT, retentionDaysError } from '../../../../../logging/model';
const props = defineProps<{ client: LogClient; apps: readonly LogApplication[] }>();
const emit = defineEmits<{ error: [error: unknown] }>();
const confirmIcon = { default: confirmDefault, hover: confirmHover, active: confirmActive, disabled: confirmDisabled };
const settings = ref<LogSettings>();
// 菜单仅随目录变化，勾选时不重建菜单，保留展开状态、焦点和未保存输入。
const appGroups = computed<GroupMenuGroup[]>(() => props.apps.map(app => ({
  id: app.id, label: app.name, items: [], expanded: true,
})));
type LogTypeGroup = { label: string; types: LogType[] };
const typeGroups = computed(() => new Map<string, LogTypeGroup[]>(props.apps.map(app => {
  const groups = new Map<string, LogTypeGroup>();
  for (const type of app.logTypes || []) {
    const label = type.group || '通用记录';
    let group = groups.get(label);
    if (!group) {
      group = { label, types: [] };
      groups.set(label, group);
    }
    group.types.push(type);
  }
  return [app.id, [...groups.values()]];
})));
const days = ref('');
const rules = {
  days: { required: true, message: '请填写日志保留天数', validate: (value: unknown) => retentionDaysError(Number(value)) },
};
const logPath = ref('');
/** 默认目录（地址留空时日志落在哪）；地址没填过时，摆出来的就是它。 */
const defaultPath = ref('');
/** 上次落盘生效的地址；只有它变了才去换目录，避免每次保存都重建存储。 */
const savedPath = ref('');
/** 地址这一格是**路径行**：宿主得能读、能存、能挑目录，三样齐了才谈得上"配一个地址"。 */
const hasPath = computed(() =>
  typeof props.client.getPath === 'function' &&
  typeof props.client.savePath === 'function' &&
  typeof props.client.pickPath === 'function',
);
const browsePath = computed(() => props.client.pickPath?.bind(props.client));
/** 落盘口径：值恰好是默认目录时写空串。「跟随默认目录」这件事留在配置里，
 *  否则默认目录一换（安装位置变了、便携化），旧地址就被钉死在配置里。 */
function persistValue(value: string) {
  const text = value.trim();
  return text === defaultPath.value ? '' : text;
}
const busy = ref(false),
  error = ref(''),
  saved = ref(false);
let alive = true;
onBeforeUnmount(() => {
  alive = false;
});
async function load() {
  busy.value = true;
  error.value = '';
  try {
    const value = await props.client.getSettings();
    if (alive) {
      settings.value = value;
      days.value = String(value.retentionDays);
    }
    if (hasPath.value) {
      let fallback = '';
      if (typeof props.client.defaultPath === 'function') {
        const value = await props.client.defaultPath();
        if (!alive) return;
        fallback = String(value || '');
        defaultPath.value = fallback;
      }
      const directory = await props.client.getPath!();
      if (alive) {
        // 地址还没填过时，把默认目录本身摆进这一格：显示的就是实际地址。
        logPath.value = directory || fallback;
        savedPath.value = directory;
      }
    }
  } catch (reason) {
    if (alive) error.value = String(reason instanceof Error ? reason.message : reason);
  } finally {
    if (alive) busy.value = false;
  }
}
async function save() {
  if (!settings.value || busy.value) return;
  const retentionDays = Number(days.value);
  busy.value = true;
  saved.value = false;
  error.value = '';
  try {
    // 先换地址：它决定日志文件落在哪；"保留时长 / 记录类型"是写进那个文件的，
    // 顺序反了就会把设置写进旧文件、再由换地址丢掉。
    if (hasPath.value && persistValue(logPath.value) !== persistValue(savedPath.value)) {
      const directory = await props.client.savePath!(persistValue(logPath.value));
      if (alive) {
        savedPath.value = directory;
        logPath.value = directory || defaultPath.value;
      }
    }
    const value = await props.client.saveSettings({
      ...await props.client.getSettings(),
      retentionDays,
      types: JSON.parse(JSON.stringify(settings.value.types)),
    });
    if (alive) {
      settings.value = value;
      days.value = String(value.retentionDays);
      saved.value = true;
    }
  } catch (reason) {
    if (alive) {
      error.value = reason instanceof Error ? reason.message : String(reason);
      emit('error', reason);
    }
  } finally {
    if (alive) busy.value = false;
  }
}
onMounted(load);
</script>
<template>
  <CxxForm class="cxx-log-settings" :model-value="{ days }" :rules="rules" :aria-busy="busy" @submit="save">
    <CxxPanelForm class="cxx-log-settings-panel">
      <div class="cxx-log-settings-fields">
        <p>所有应用共用保留时长。关闭记录类型只影响之后的记录，已有日志仍可查看。</p>
        <p>保存后会清理超过保留时长的日志；最多保留最近 {{ LOG_ENTRY_LIMIT.toLocaleString() }} 条。</p>
        <template v-if="settings">
          <CxxInputPath
            v-if="hasPath"
            v-model="logPath"
            label="日志地址"
            placeholder="选择或填写日志目录"
            :browse="browsePath"
            :disabled="busy"
          />
          <p v-if="hasPath">日志写入该目录，已有日志不随地址变更搬迁。</p>
          <CxxFormField name="days" label="日志保留天数" required>
            <CxxInput v-model="days" label="日志保留天数" label-hidden type="number"
              min="1" :max="LOG_RETENTION_DAYS_LIMIT" step="1" :disabled="busy" />
          </CxxFormField>
          <CxxCategoryMenuGroup :groups="appGroups" label="应用日志记录类型" size="sm">
            <template #content="{ group: app }">
              <fieldset v-for="group in typeGroups.get(app.id)" :key="group.label" class="cxx-log-type-group">
                <legend>{{ group.label }}</legend>
                <div class="cxx-log-type-options">
                  <div v-for="type in group.types" :key="type.id" class="cxx-log-type-option">
                    <CxxCheckbox
                      :label="type.label"
                      :disabled="busy"
                      :model-value="settings.types[app.id]?.[type.id] !== false"
                      @update:model-value="
                        settings.types[app.id]![type.id] = $event;
                        saved = false;
                      "
                    />
                    <small v-if="type.description">{{ type.description }}</small>
                  </div>
                </div>
              </fieldset>
            </template>
          </CxxCategoryMenuGroup>
        </template>
        <template v-else>
          <CxxButton :disabled="busy" @click="load">{{ busy ? '加载中…' : '重试加载' }}</CxxButton>
          <p v-if="error" role="alert">{{ error }}</p>
        </template>
      </div>
      <template v-if="settings" #footer>
        <div v-if="error || saved" class="cxx-panel-form-feedback">
          <p v-if="error" role="alert">{{ error }}</p>
          <p v-else role="status">日志设置已保存</p>
        </div>
        <CxxButton preset="confirm" :icon="confirmIcon"
          type="submit" label="保存日志设置" :disabled="busy" :busy="busy" />
      </template>
    </CxxPanelForm>
  </CxxForm>
</template>
