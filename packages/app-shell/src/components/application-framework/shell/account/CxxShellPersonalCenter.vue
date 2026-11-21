<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, toRef, watch } from 'vue';
import { CxxAlert, CxxButton, CxxCard, CxxEmpty } from '@cxx/ui';
import type { PersonalAccountClient, PersonalWorkspaceTarget } from '../../../../account';
import { usePersonalAccountSnapshot } from './personal-account-snapshot';

const props = defineProps<{ client: PersonalAccountClient; navigate?: (target: PersonalWorkspaceTarget) => void }>();
const emit = defineEmits<{ identity: [name: string] }>();
const accountState = usePersonalAccountSnapshot(toRef(props, 'client'));
const { snapshot, reading } = accountState;
type AccountAction = 'login' | 'logout' | 'store' | 'register';
const refreshing = ref(false), error = ref<{ code: string; message: string }>();
const action = ref<AccountAction>();
const activeSoftware = ref<string>();
const busy = computed(() => reading.value || action.value !== undefined);
const actionReason = computed(() => action.value === 'login'
  ? '登录正在进行，请在认证窗口完成或取消登录。'
  : action.value ? '当前操作正在进行，请等待完成。' : undefined);
const retrySignOut = ref(false);
let readController: AbortController | undefined, actionController: AbortController | undefined;
let actionRevision = 0, disposed = false;
const displayedError = computed(() => error.value?.message || snapshot.value?.issue?.message || (accountState.failure.value ? guidance(accountState.failure.value) : ''));
watch(snapshot, value => {
  // 对等窗口恢复已验证身份后，旧的登录互斥错误已不再成立。
  if (value?.identity && error.value?.code === 'ACCOUNT_BUSY') error.value = undefined;
  retrySignOut.value = value?.signOutPending === true;
  if (value) emit('identity', value.identity?.displayName || '未登录');
});

/** 只保留宿主错误分类，用于选择公开恢复引导。 */
function failureCode(failure: unknown) {
  return failure && typeof failure === 'object' && 'code' in failure ? String(failure.code) : '';
}

/** 预期账户状态展示恢复入口，不暴露宿主或网络原始异常。 */
function guidance(failure: unknown) {
  const code = failureCode(failure);
  if (code === 'LOGIN_CANCELLED') return '';
  if (code === 'LOGIN_REQUIRED') return '请先登录账户，再查看本人的订阅。';
  if (code === 'ACCOUNT_BUSY') return '登录正在进行。请在已有认证窗口完成或取消登录，或稍后重试。';
  if (code === 'ACCOUNT_CONFIGURATION_REQUIRED') return '账户接入尚未完成，请检查认证服务地址、客户端编号与登记回调，然后重试登录。';
  if (code === 'ACCOUNT_REGISTRATION_UNAVAILABLE') return '注册入口尚未配置，请使用已有账户登录或联系维护者。';
  if (code === 'REVOCATION_UNCONFIRMED') return '本机已退出，中心确认暂未完成。请检查连接后重试退出。';
  if (code === 'ACCOUNT_LOGOUT_PENDING') return '本机已退出，中心浏览器退出尚待确认。请重试退出，完成后即可重新登录。';
  return '暂时无法连接账户服务，请检查服务地址或网络后重试；原有资料和草稿已保留。';
}

/** 每次读取独立失效，切页或退出后的迟到结果不能恢复旧身份。 */
async function load() {
  if (disposed) return;
  readController?.abort(); readController = new AbortController();
  error.value = undefined;
  // 读取失败及恢复由共享快照呈现，不另存一份会在恢复后残留的错误。
  await accountState.read(readController.signal).catch(() => undefined);
}

/** 身份与购买动作由宿主执行，组件不直接请求认证或支付接口。 */
async function act(operation: AccountAction, applicationId?: string) {
  if (action.value || disposed) return;
  if (props.navigate) {
    props.navigate({ page: operation === 'store' ? 'store' : operation === 'logout' ? 'logout' : 'login', applicationId }); return;
  }
  if (operation === 'login' || operation === 'logout') { readController?.abort(); accountState.invalidate(); }
  actionController = new AbortController();
  const current = ++actionRevision, signal = actionController.signal;
  action.value = operation; activeSoftware.value = applicationId; error.value = undefined;
  if (operation === 'logout') { accountState.clear(); emit('identity', '未登录'); }
  try {
    if (operation === 'login') await props.client.signIn(signal);
    else if (operation === 'logout') await props.client.signOut();
    else if (operation === 'register') await props.client.openRegistration?.();
    else await props.client.openStore(applicationId);
    if (!disposed && current === actionRevision && !signal.aborted
      && (operation === 'login' || operation === 'logout')) {
      await load();
    }
  } catch (failure) {
    if (!disposed && current === actionRevision && !signal.aborted) {
      const code = failureCode(failure);
      error.value = code === 'ACCOUNT_BUSY' && snapshot.value?.identity ? undefined : { code, message: guidance(failure) };
      if (['REVOCATION_UNCONFIRMED', 'ACCOUNT_LOGOUT_PENDING'].includes(code)) retrySignOut.value = true;
    }
  } finally {
    if (!disposed && current === actionRevision) {
      action.value = undefined; activeSoftware.value = undefined;
    }
  }
}

/** 显式刷新仅标记刷新动作，后台读取不让全部操作按钮进入忙碌状态。 */
async function refresh() {
  if (action.value || refreshing.value) return;
  refreshing.value = true;
  try { await load(); } finally { if (!disposed) refreshing.value = false; }
}

/** 取消认证窗口及本次登录，保留已有资料。 */
function cancelLogin() { if (action.value === 'login') actionController?.abort(); }

/** 到期时间只作显示，软件是否可用必须由宿主重新核验。 */
function expiry(value?: string) {
  if (!value) return '暂无有效订阅';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : '期限暂不可读取';
}
/** 商城导航由明确菜单操作触发，读取中也可离开，不自动下单。 */
async function openStore(applicationId?: string) {
  await act('store', applicationId);
}
defineExpose({ openStore });
onMounted(() => { void load(); });
onBeforeUnmount(() => {
  disposed = true; actionRevision++;
  readController?.abort(); actionController?.abort();
});
</script>
<template>
  <section class="cxx-personal-center" aria-label="个人中心" :aria-busy="busy">
    <header><h1>个人中心</h1><p>{{ snapshot?.identity?.displayName || '登录后查看个人订阅，免费软件无需购买。' }}</p></header>
    <div class="cxx-personal-actions">
      <CxxButton v-if="retrySignOut" :busy="action === 'logout'" :disabled="!!action && action !== 'logout'" :help="{purpose: '重试确认原账户退出，不重用旧令牌', unavailableReason: actionReason}" @click="act('logout')">重试退出</CxxButton>
      <CxxButton v-else-if="!snapshot?.identity" :busy="action === 'login'" :disabled="!!action && action !== 'login'" :help="{purpose: '登录统一账户并读取本人的订阅', unavailableReason: actionReason}" @click="act('login')">登录账户</CxxButton>
      <CxxButton v-else :busy="action === 'logout'" :disabled="!!action && action !== 'logout'" :help="{purpose: '退出当前账户并撤销本次登录', unavailableReason: actionReason}" @click="act('logout')">退出账户</CxxButton>
      <CxxButton v-if="action === 'login'" :help="{purpose: '关闭认证窗口并取消此次登录'}" @click="cancelLogin">取消登录</CxxButton>
      <CxxButton v-if="!navigate && !snapshot?.identity && !retrySignOut && client.openRegistration" :busy="action === 'register'" :disabled="!!action && action !== 'register'" :help="{purpose: '打开官网注册，账户资料由中央验证', unavailableReason: actionReason}" @click="act('register')">注册账户</CxxButton>
      <CxxButton :busy="refreshing" :disabled="!!action" :help="{purpose: '重新核对当前账户及各软件使用资格', unavailableReason: actionReason}" @click="refresh">刷新订阅</CxxButton>
      <CxxButton :busy="action === 'store' && !activeSoftware" :disabled="!!action && (action !== 'store' || !!activeSoftware)" :help="{purpose: '浏览已发布软件，不要求先购买套餐', unavailableReason: actionReason}" @click="act('store')">逛逛软件</CxxButton>
    </div>
    <CxxAlert v-if="displayedError" tone="warning" title="可以这样继续">{{ displayedError }}</CxxAlert>
    <p>公共基建持续可用；订阅仅影响对应软件的能力，原有资料保留。</p>
    <h2>我的软件与订阅</h2>
    <div class="cxx-personal-software">
      <CxxCard v-for="item in snapshot?.software || []" :key="item.applicationId" :title="item.name">
        <img v-if="item.icon" :src="item.icon" alt="" width="44" height="44" />
        <p>{{ item.planName || (item.mode === 'UNAVAILABLE' ? '软件资料待核对' : item.mode === 'FREE' ? '免费使用' : (item.allowed ? '订阅生效中' : '暂无可用订阅')) }}</p>
        <p v-if="item.mode === 'SUBSCRIPTION' && item.accessKind !== 'DEVELOPMENT' && item.startsAt">订阅开始：{{ expiry(item.startsAt) }}</p>
        <p v-if="item.mode === 'SUBSCRIPTION' && item.accessKind !== 'DEVELOPMENT'">到期：{{ expiry(item.expiresAt) }}</p>
        <p v-if="item.accessKind === 'DEVELOPMENT'">从左上角切换器打开软件即可开发，无须先录入商品、套餐或价格。</p>
        <p>{{ item.allowed ? '当前可用' : item.reason }}</p>
        <template #actions><CxxButton v-if="item.accessKind !== 'DEVELOPMENT'" :busy="action === 'store' && activeSoftware === item.applicationId" :disabled="!!action && !(action === 'store' && activeSoftware === item.applicationId)" :help="{purpose: '查看此软件的介绍、套餐及本人可用的续费升级操作', unavailableReason: actionReason}" @click="act('store', item.applicationId)">{{ item.mode === 'SUBSCRIPTION' ? (item.expiresAt ? '续费 / 查看套餐' : '查看套餐') : '查看软件' }}</CxxButton></template>
      </CxxCard>
    </div>
    <CxxEmpty v-if="snapshot && !snapshot.software.length" description="暂无已接入的软件；可以先逛逛软件。" />
  </section>
</template>
<style src="../../../../account.css"></style>
