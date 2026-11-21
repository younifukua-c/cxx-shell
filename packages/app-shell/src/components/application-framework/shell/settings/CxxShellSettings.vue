<script setup lang="ts">
import { watch } from 'vue';
import { CxxDialog } from '@cxx/ui';
import type { SettingsItem } from '../../../../settings';
import SettingsContent from './internal/SettingsContent.vue';
import SettingsNav from './internal/SettingsNav.vue';
const props = withDefaults(defineProps<{ title?: string; items: readonly SettingsItem[] }>(), { title: '设置' });
const opened = defineModel<boolean>('open', { default: false });
const selected = defineModel<string>({ default: '' });
watch(() => props.items, items => {
  if (!items.some(item => item.id === selected.value && !item.disabled)) selected.value = items.find(item => !item.disabled)?.id || '';
}, { immediate: true });
</script>
<template>
  <CxxDialog v-model:open="opened" :title="title" :width="1100" :height="720">
    <div class="cxx-settings-layout">
      <SettingsNav v-model="selected" :items="items" :label="`${title}选项`" />
      <SettingsContent v-model="selected" :items="items">
        <template #default="{ id, item }"><slot v-if="opened" :id="id" :item="item" /></template>
      </SettingsContent>
    </div>
  </CxxDialog>
</template>
