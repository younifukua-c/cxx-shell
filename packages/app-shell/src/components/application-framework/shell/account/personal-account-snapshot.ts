import {
  inject,
  onBeforeUnmount,
  provide,
  ref,
  shallowRef,
  watch,
  type InjectionKey,
  type Ref,
} from 'vue';
import type { PersonalAccountClient } from '../../../../account';

type Client = Readonly<Ref<PersonalAccountClient | undefined>>;
type Snapshot = Awaited<ReturnType<PersonalAccountClient['read']>>;
const snapshotKey: InjectionKey<{ client: Client; state: ReturnType<typeof createSnapshot> }> =
  Symbol('personal-account-snapshot');

/** 每个外壳独立持有身份和资格，个人中心复用同一份快照与变更订阅。 */
function createSnapshot(client: Client) {
  const snapshot = shallowRef<Snapshot>(),
    unavailable = ref(false),
    reading = ref(false),
    failure = shallowRef<unknown>();
  const verified = ref(false);
  let revision = 0,
    controller: AbortController | undefined,
    stop: (() => void) | undefined,
    disposed = false;
  let latest: Promise<Snapshot | undefined> | undefined;

  function invalidate() {
    revision++;
    controller?.abort();
    reading.value = false;
  }
  function clear() {
    invalidate();
    snapshot.value = undefined;
    unavailable.value = false;
    verified.value = false;
    failure.value = undefined;
  }

  /** 取消、替换端口与销毁之后，迟到结果不得发布；失败保留已有展示资料。 */
  async function load(signal?: AbortSignal) {
    if (disposed || signal?.aborted) return;
    invalidate();
    const current = revision,
      port = client.value,
      request = new AbortController();
    controller = request;
    if (!port) {
      snapshot.value = undefined;
      unavailable.value = false;
      failure.value = undefined;
      return;
    }
    const cancel = () => request.abort();
    signal?.addEventListener('abort', cancel, { once: true });
    reading.value = true;
    try {
      const value = await port.read(request.signal);
      if (disposed || request.signal.aborted || revision !== current) return;
      snapshot.value = value;
      unavailable.value = false;
      failure.value = undefined;
      verified.value = true;
      return value;
    } catch (error) {
      if (!disposed && !request.signal.aborted && revision === current) {
        unavailable.value = true;
        verified.value = false;
        failure.value = error;
        throw error;
      }
    } finally {
      signal?.removeEventListener('abort', cancel);
      if (!disposed && revision === current) reading.value = false;
    }
  }
  /** 单次读取仍拒绝迟到结果；记录最新请求供认证完成后的确认使用。 */
  function read(signal?: AbortSignal) {
    const pending = Promise.resolve().then(() => load(signal));
    latest = pending;
    return pending;
  }
  /** 认证完成与通知刷新重叠时等待最新请求，不能把已失效读取当作认证失败。 */
  async function readLatest(signal: AbortSignal) {
    let pending = read(signal);
    while (!disposed && !signal.aborted) {
      const value = await pending;
      if (disposed || signal.aborted) return;
      if (!latest || pending === latest) return value;
      pending = latest;
    }
  }
  /** 后台刷新由共享的不可用状态提供恢复入口，原始异常不向界面传播。 */
  const refresh = () => read().catch(() => undefined);
  /** 显式返回先撤下旧资格展示，保留身份与草稿，等待新裁决。 */
  function revalidate() {
    invalidate();
    verified.value = false;
    return refresh();
  }
  watch(
    client,
    (port) => {
      stop?.();
      clear();
      stop = port?.onChanged?.((event) => {
        if (event?.invalidate) clear();
        void refresh();
      });
      void refresh();
    },
    { immediate: true },
  );
  onBeforeUnmount(() => {
    disposed = true;
    invalidate();
    stop?.();
  });
  return {
    snapshot,
    unavailable,
    reading,
    verified,
    failure,
    read,
    readLatest,
    refresh,
    revalidate,
    invalidate,
    clear,
  };
}

/** 外壳拥有本实例生命周期，不与其他外壳或其他账户端口共享状态。 */
export function providePersonalAccountSnapshot(client: Client) {
  const state = createSnapshot(client);
  provide(snapshotKey, { client, state });
  return state;
}

/** 独立个人中心自持快照，嵌入同一外壳时复用所属外壳的事实源。 */
export function usePersonalAccountSnapshot(client: Client) {
  const shared = inject(snapshotKey, undefined);
  return shared && shared.client.value === client.value ? shared.state : createSnapshot(client);
}
