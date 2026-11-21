<script setup lang="ts">
import { computed } from 'vue';
import { CxxButton, CxxCategoryMenuGroup, CxxMsgTooltip, type MenuItem, type GroupMenuGroup } from '@cxx/ui';
import switchIcon from '@cxx/icons/assets/exchange-horizontal.svg';
import type { PersonalWorkspaceTarget } from '../../../../account';

const props = defineProps<{
  items: readonly MenuItem[];
  target?: PersonalWorkspaceTarget;
  compact?: boolean;
  selectedItem?: string;
}>();
const emit = defineEmits<{ back: []; select: [item: MenuItem] }>();
const returnHint = '切换回应用';
const selected = computed(() => {
  if (props.selectedItem) return props.selectedItem;
  const page = props.target?.page;
  return page && !['login', 'logout'].includes(page) ? 'cxx:' + page : 'cxx:account';
});
const groups = computed<GroupMenuGroup[]>(() => [
  {
    id: 'personal',
    label: '个人工作区',
    items: props.items.map((item) =>
      item.id === 'cxx:account' ? { ...item, label: '个人中心' } : item,
    ),
  },
]);
/** 导航仅交付已登记的菜单项，不把任意地址交给页面。 */
function select(id: string) {
  const item = props.items.find((item) => item.id === id);
  if (item) emit('select', item);
}
</script>
<template>
  <nav class="cxx-personal-navigation" aria-label="个人工作区导航" :data-compact="compact || undefined">
    <CxxMsgTooltip :text="returnHint" class="cxx-personal-back" v-slot="{ describedBy }">
      <CxxButton
        class="cxx-icon-monochrome"
        :icon="switchIcon"
        label="返回应用"
        :help="{ purpose: returnHint }"
        :aria-describedby="describedBy"
        title=""
        size="sm"
        bare
        icon-only
        @click="emit('back')"
      />
    </CxxMsgTooltip>
    <CxxCategoryMenuGroup
      class="cxx-personal-menu"
      :model-value="selected"
      :groups="groups"
      :compact="compact"
      size="sm"
      label="个人工作区选项"
      @update:model-value="select"
    />
  </nav>
</template>
