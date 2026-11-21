<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { CxxButton, CxxCheckbox, CxxInputLimit, CxxPanelForm, type LimitValue } from '@cxx/ui';
import dismissIcon from '@cxx/icons/assets/63-dismiss.svg';
import {
  isNotificationMuted, notificationSettings, NOTIFICATION_KINDS, NOTIFICATION_MAX_DURATION_MS,
  type NotificationKind, type NotificationSettings,
} from '@cxx/ui/notifications';
import type { LogClient } from '../../../../../logging';
const props = defineProps<{ client: LogClient }>();
const emit = defineEmits<{ error: [error: unknown] }>();
const values = ref<NotificationSettings>(), busy = ref(false), error = ref('');
const labels = { success: '成功', info: '消息', warn: '警告', error: '失败' };
const msPerSecond = 1000;
const defaultDurations = notificationSettings().durations;
let alive = true;
onBeforeUnmount(() => { alive = false; });
function readLimit(settings: NotificationSettings, kind: NotificationKind): LimitValue {
  if (isNotificationMuted(kind, settings)) return { mode: 'none' };
  const duration = settings.durations[kind];
  return duration === 0 ? { mode: 'unlimited' } : { mode: 'finite', value: duration / msPerSecond };
}
function updateLimit(kind: NotificationKind, limit: LimitValue) {
  const settings = values.value;
  if (!settings) return;
  const muted = (settings.muted ?? []).filter(item => item !== kind);
  if (limit.mode === 'none') muted.push(kind);
  else settings.durations[kind] = limit.mode === 'unlimited' ? 0 : Math.round(limit.value * msPerSecond);
  settings.muted = muted;
}
async function load() {
  busy.value = true; error.value = '';
  try { const value = await props.client.getSettings(); if (alive) values.value = notificationSettings(value.notifications); }
  catch (reason) { if (alive) error.value = String(reason instanceof Error ? reason.message : reason); }
  finally { if (alive) busy.value = false; }
}
async function save(event: SubmitEvent) {
  if (busy.value || !values.value) return;
  const form = event.currentTarget as HTMLFormElement;
  const focused = (form.getRootNode() as Document | ShadowRoot).activeElement;
  if (focused instanceof HTMLInputElement && form.contains(focused)) focused.blur();
  const invalid = form.querySelector<HTMLElement>('[aria-invalid="true"]');
  if (invalid) {
    invalid.scrollIntoView({ block: 'nearest' });
    invalid.focus();
    return;
  }
  busy.value = true; error.value = '';
  try {
    const notifications = notificationSettings(values.value);
    const latest = await props.client.getSettings();
    if (!alive) return;
    const result = await props.client.saveSettings({ ...latest, notifications });
    if (!alive) return;
    const persisted = notificationSettings(result.notifications);
    if (NOTIFICATION_KINDS.some(kind => isNotificationMuted(kind, persisted) !== isNotificationMuted(kind, notifications)))
      throw Error('当前宿主未保存弹出开关，请更新后重试');
    values.value = persisted;
  } catch (reason) { if (alive) { error.value = String(reason instanceof Error ? reason.message : reason); emit('error', reason); } }
  finally { if (alive) busy.value = false; }
}
onMounted(load);
</script>
<template>
  <form class="cxx-log-settings" :aria-busy="busy" novalidate @submit.prevent="save">
    <CxxPanelForm class="cxx-log-settings-panel">
      <div class="cxx-log-settings-fields">
        <template v-if="values">
          <div v-for="kind in NOTIFICATION_KINDS" :key="kind" class="cxx-notification-setting">
            <span>{{ labels[kind] }}提示</span>
            <CxxInputLimit :model-value="readLimit(values, kind)" :label="labels[kind] + '提示'" unit="秒"
              :min="1 / msPerSecond" :max="NOTIFICATION_MAX_DURATION_MS / msPerSecond" :step="1 / msPerSecond"
              :default-value="(values.durations[kind] || defaultDurations[kind]) / msPerSecond"
              :none-icon="dismissIcon" none-label="关闭弹出提示" unlimited-label="一直显示，直到手动关闭"
              :disabled-reason="busy ? '消息设置正在保存' : undefined"
              @update:model-value="updateLimit(kind, $event)" />
          </div>
          <CxxCheckbox v-model="values.logAnimation" label="日志收取动画" :disabled="busy" />
        </template>
        <template v-else>
          <CxxButton :disabled="busy" @click="load">{{ busy ? '加载中…' : '重试加载' }}</CxxButton>
          <p v-if="error" role="alert">{{ error }}</p>
        </template>
      </div>
      <template v-if="values" #footer>
        <div v-if="error" class="cxx-panel-form-feedback"><p role="alert">{{ error }}</p></div>
        <CxxButton preset="confirm" type="submit" label="保存消息设置" :disabled="busy" :busy="busy"
          @mousedown.prevent
          :help="{ purpose: '保存消息提示偏好', unavailableReason: '消息设置正在保存' }" />
      </template>
    </CxxPanelForm>
  </form>
</template>
