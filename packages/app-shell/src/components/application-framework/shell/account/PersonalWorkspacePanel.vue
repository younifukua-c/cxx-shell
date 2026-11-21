<script setup lang="ts">
import { ref } from 'vue';
import { CxxCard, type ThemeName } from '@cxx/ui';
import type { PersonalAccountClient, PersonalWorkspaceTarget } from '../../../../account';
import PersonalAccountView from './PersonalAccountView.vue';
import PersonalCenter from './CxxShellPersonalCenter.vue';

defineProps<{
  client: PersonalAccountClient;
  theme: ThemeName;
  target?: PersonalWorkspaceTarget;
  help: boolean;
}>();
const emit = defineEmits<{ navigate: [target?: PersonalWorkspaceTarget] }>();
const legacy = ref<InstanceType<typeof PersonalCenter>>();
/** 未接原生槽的宿主仍通过既有公开商城端口操作。 */
function openStore(applicationId?: string) {
  return legacy.value?.openStore(applicationId);
}
defineExpose({ openStore });
</script>
<template>
  <section class="cxx-personal-panel" aria-label="个人工作区内容">
    <CxxCard v-if="help" class="cxx-personal-help" role="region" aria-label="帮助">
      <h1>帮助</h1>
      <p>通过个人菜单查看订阅、浏览软件商城或维护个人信息。</p>
      <p>点击「个人工作区」标题右侧的切换图标，回到进入前的页面并保留草稿。需要续费时可前往软件商城。</p>
    </CxxCard>
    <PersonalAccountView
      v-else-if="client.workspace"
      :client="client"
      :theme="theme"
      :target="target"
      @navigate="emit('navigate', $event)"
    />
    <PersonalCenter v-else ref="legacy" :client="client" />
  </section>
</template>
