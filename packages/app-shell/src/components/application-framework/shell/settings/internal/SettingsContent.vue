<script setup lang="ts">
/**
 * 设置内容区（占应用主区）。
 * 与弹窗版设置共用 cxx-settings-content / cxx-settings-section-heading 类，
 * 但只渲染内容，不含标题栏与关闭按钮 —— 退出靠左上角下拉切回应用。
 */
import { computed } from 'vue';
import { CxxPanelForm } from '@cxx/ui';
import type { SettingsItem } from '../../../../../settings';

const props = defineProps<{ items: readonly SettingsItem[] }>();
const selected = defineModel<string>({ default: '' });
const current = computed(() => props.items.find((item) => item.id === selected.value));
</script>
<template>
  <CxxPanelForm class="cxx-settings-content" :aria-label="current?.label"
    :data-content-owns-scroll="current?.contentOwnsScroll ? '' : undefined">
    <template v-if="current" #header>
      <div class="cxx-settings-section-heading">
        <h3>{{ current.label }}</h3>
        <p v-if="current.description" class="cxx-muted">{{ current.description }}</p>
      </div>
    </template>
    <slot :id="selected" :item="current" />
  </CxxPanelForm>
</template>
