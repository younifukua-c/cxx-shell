<script setup lang="ts">
import { ref, toRef, watch } from 'vue';
import type { ThemeName } from '@cxx/ui';
import type { PersonalAccountClient, PersonalWorkspaceTarget } from '../../../../account';
import PersonalWorkspace from './PersonalWorkspace.vue';
import PersonalCenter from './CxxShellPersonalCenter.vue';
import { usePersonalAccountSnapshot } from './personal-account-snapshot';

const props = defineProps<{
  client: PersonalAccountClient;
  theme: ThemeName;
  target?: PersonalWorkspaceTarget;
}>();
const emit = defineEmits<{ navigate: [target?: PersonalWorkspaceTarget] }>();
const account = usePersonalAccountSnapshot(toRef(props, 'client'));
const phase = ref<'loading' | 'ready' | 'failed'>('loading');
watch(
  () => JSON.stringify(props.target),
  () => {
    phase.value = 'loading';
  },
  { flush: 'sync' },
);
// 对等认证完成只撤下失败的登录槽；进行中的所属认证必须等待宿主完成。
watch(
  () => [
    props.target?.page,
    phase.value,
    account.verified.value,
    account.snapshot.value?.identity?.subject,
  ],
  () => {
    if (
      props.target?.page === 'login' &&
      phase.value === 'failed' &&
      account.verified.value &&
      account.snapshot.value?.identity
    )
      emit('navigate');
  },
);
watch(
  () => props.target?.page,
  (page) => {
    if (page === 'logout') account.clear();
  },
  { immediate: true },
);
/** 中央页面完成后重新读取身份；失败留在原登录页并提供重试，不能假装登录成功。 */
async function completed(signal: AbortSignal) {
  const snapshot = await account.readLatest(signal);
  if (signal.aborted) return;
  if (!snapshot || (props.target?.page === 'login' ? !snapshot.identity : !!snapshot.identity))
    throw new Error('身份变更尚未确认');
  emit('navigate');
}
</script>
<template>
  <PersonalWorkspace
    v-if="target && client.workspace"
    :key="JSON.stringify(target)"
    :client="client.workspace"
    :target="target"
    :theme="theme"
    :completed="completed"
    @state="phase = $event"
  />
  <PersonalCenter
    v-else
    :client="client"
    :navigate="client.workspace ? (target) => emit('navigate', target) : undefined"
  />
</template>
