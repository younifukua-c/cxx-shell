<script setup lang="ts">
/**
 * 设置导航（放在应用侧栏位）。
 * 整页设置态下，左侧的"项目看板"整体换成它 —— 用中央的分组菜单组件渲染，
 * 外层仍挂 cxx-settings-nav：宽度、滚动与分隔线由设置页的样式给，行与反馈都由组件负责。
 */
import { computed } from 'vue';
import settingsIcon from '@cxx/icons/assets/01-settings.svg';
import { CxxCategoryMenuGroup, type GroupMenuGroup } from '@cxx/ui';
import type { SettingsItem } from '../../../../../settings';

const props = defineProps<{ items: readonly SettingsItem[]; compact?: boolean; label?: string }>();
const selected = defineModel<string>({ default: '' });

/** 条目自带分组名；按首次出现的顺序归组，同名归成一组。 */
const groups = computed<GroupMenuGroup[]>(() => {
  const result: GroupMenuGroup[] = [];
  for (const item of props.items) {
    const label = item.group || '';
    let group = result.find((entry) => entry.label === label);
    if (!group) {
      group = { id: label, label, items: [] };
      result.push(group);
    }
    group.items.push({ id: item.id, label: item.label, icon: item.icon || settingsIcon, disabled: item.disabled });
  }
  return result;
});
</script>
<template>
  <CxxCategoryMenuGroup
    v-model="selected"
    class="cxx-settings-nav"
    presentation="sidebar"
    :label="label || '设置选项'"
    :groups="groups"
    :compact="compact"
    :data-compact="compact || undefined"
  />
</template>
