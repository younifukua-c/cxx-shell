<script setup lang="ts">
import { computed } from 'vue';
import { CxxSelect, type ThemeName } from '@cxx/ui';
import type { SettingsItem } from '../../../../../settings';
import type { LogClient } from '../../../../../logging';
import {
  createMemoryFileManageClient,
  type FileManageClient,
} from '../../../../../file-management/index';
import SettingsContent from '../../settings/internal/SettingsContent.vue';
import NotificationSettings from '../../settings/internal/NotificationSettings.vue';
import FileManageSettings from '../../settings/internal/FileManageSettings.vue';
import LogCenter from '../../../log/center/CxxLogCenter.vue';

const props = defineProps<{
  items: readonly SettingsItem[];
  theme: ThemeName;
  current: string;
  client: LogClient;
  fileManagement?: FileManageClient;
}>();
const selected = defineModel<string>({ required: true });
const emit = defineEmits<{ error: [error: unknown]; themeChange: [theme: ThemeName] }>();
const fallback = createMemoryFileManageClient();
const fileClient = computed(() => props.fileManagement || fallback);
const themes = [
  { value: 'dark', label: '经典深色' },
  { value: 'light', label: '清晨浅色' },
  { value: 'glass', label: '通透玻璃' },
  { value: 'neutral', label: '中性灰' },
  { value: 'gilded', label: '暗夜鎏金' },
];
</script>
<template>
  <SettingsContent v-model="selected" :items="items">
    <template #default="{ id }">
      <div v-if="id === 'common:appearance'" class="cxx-settings-appearance">
        <p class="cxx-muted">统一应用页面、设置和弹窗的外观。</p>
        <CxxSelect
          :model-value="theme"
          label="主题"
          :options="themes"
          @update:model-value="emit('themeChange', $event as ThemeName)"
        />
      </div>
      <LogCenter
        v-else-if="id === 'common:logs'"
        :client="client"
        :current="current"
        settings
        @error="emit('error', $event)"
      />
      <NotificationSettings
        v-else-if="id === 'common:notifications'"
        :client="client"
        @error="emit('error', $event)"
      />
      <FileManageSettings
        v-else-if="id === 'common:folder'"
        :client="fileClient"
        @error="emit('error', $event)"
      />
      <slot v-else :id="id" />
    </template>
  </SettingsContent>
</template>
