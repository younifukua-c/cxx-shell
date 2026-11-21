<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { CxxAlert, CxxButton, CxxLoading, type ThemeName } from '@cxx/ui';
import type {
  PersonalWorkspaceClient,
  PersonalWorkspaceTarget,
} from '../../../../personal-workspace';
import { mountWorkspaceSlot } from './workspace-slot';

const props = defineProps<{
  client: PersonalWorkspaceClient;
  target: PersonalWorkspaceTarget;
  theme: ThemeName;
  completed: (signal: AbortSignal) => Promise<void>;
}>();
const emit = defineEmits<{ state: [value: 'loading' | 'ready' | 'failed'] }>();
const slot = ref<HTMLElement>();
const state = ref<'loading' | 'ready' | 'failed'>('loading');
const failureCode = ref<string>();
const titles = {
  login: '登录 / 注册',
  logout: '退出账户',
  store: '软件商城',
  website: '官网',
  preferences: '我的偏好',
};
let mounted: ReturnType<typeof mountWorkspaceSlot> | undefined;
/** 显式重试释放旧请求后新建；主题与尺寸变化不会走此入口。 */
function start() {
  mounted?.destroy();
  mounted = mountWorkspaceSlot(slot.value!, props.client, {
    target: props.target,
    theme: props.theme,
    status(value, code) {
      state.value = value;
      failureCode.value = code;
      emit('state', value);
    },
    completed: props.completed,
  });
}
watch(
  () => props.theme,
  (value) => mounted?.setTheme(value),
);
watch(() => props.client, start, { flush: 'post' });
onMounted(start);
onBeforeUnmount(() => mounted?.destroy());
</script>
<template>
  <section
    ref="slot"
    class="cxx-personal-workspace"
    :data-cxx-workspace-page="target.page"
    :data-cxx-workspace-state="state"
    :aria-label="titles[target.page]"
    :aria-busy="state === 'loading'"
  >
    <div v-if="state === 'loading'" class="cxx-personal-workspace-status" role="status">
      <CxxLoading :title="`正在打开${titles[target.page]}…`" :presentation="false" />
    </div>
    <CxxAlert
      v-else-if="state === 'failed'"
      tone="warning"
      :title="`${titles[target.page]}暂时无法打开`"
    >
      <p v-if="failureCode === 'ACCOUNT_BUSY'">
        另一软件正在完成账户验证，请先完成或关闭原账户页面后重试。
      </p>
      <p
        v-else-if="
          target.page === 'store' || target.page === 'website' || target.page === 'preferences'
        "
      >
        请确认官网服务已启动并可访问后重试，原有资料和草稿已保留。
      </p>
      <p v-else>请检查认证服务连接后重试，原有资料和草稿已保留。</p>
      <CxxButton :help="{ purpose: '重新打开当前账户页面，保留原有业务草稿' }" @click="start">
        重试
      </CxxButton>
    </CxxAlert>
  </section>
</template>
