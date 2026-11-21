<script setup lang="ts">
import { CxxCategoryMenu, type MenuItem } from '@cxx/ui';
defineProps<{ name: string; items: readonly MenuItem[]; triggerClass: string }>();
const emit = defineEmits<{ select: [item: MenuItem] }>();
</script>
<template>
  <div class="cxx-shell-account" role="group" :aria-label="name">
    <CxxCategoryMenu
      label="账户菜单"
      :items="items"
      match-trigger-width
      placement="top"
      :trigger-class="triggerClass"
      @select="emit('select', $event)"
    >
      <template #trigger>
        <span class="cxx-account-avatar" aria-hidden="true"></span>
        <span class="cxx-account-name" aria-live="polite" aria-atomic="true">{{ name }}</span>
      </template>
    </CxxCategoryMenu>
  </div>
</template>
