import type { ThemeName } from '@cxx/ui';
import type {
  PersonalWorkspaceBounds,
  PersonalWorkspaceClient,
  PersonalWorkspaceTarget,
} from '../../../../personal-workspace';

interface SlotOptions {
  target: PersonalWorkspaceTarget;
  theme: ThemeName;
  /** 公开状态；失败不泄露宿主原始诊断。 */
  status(value: 'loading' | 'ready' | 'failed', code?: string): void;
  /** 登录或退出完成后由拥有者刷新身份并决定导航。 */
  completed(signal: AbortSignal): Promise<void>;
}
type Geometry = { bounds: PersonalWorkspaceBounds; theme: ThemeName };

/** 一次槽的所有权；观察只提交尺寸，绝不因尺寸、主题或账户刷新重复 open。 */
export function mountWorkspaceSlot(
  element: HTMLElement,
  client: PersonalWorkspaceClient,
  options: SlotOptions,
) {
  const id = `personal-${crypto.randomUUID()}`;
  const controller = new AbortController();
  const win = element.ownerDocument.defaultView!;
  const root = element.getRootNode();
  let disposed = false,
    opened = false,
    frame = 0,
    resizing = false;
  let theme = options.theme,
    sent = '',
    queued: Geometry | undefined;

  /** 合并滚动与布局事件，在下一帧读取一次实际可见矩形。 */
  function schedule() {
    if (disposed || frame) return;
    frame = win.requestAnimationFrame(measure);
  }
  /** 关闭只作用于本请求，忽略旧宿主 Promise 的迟到完成。 */
  function destroy() {
    if (disposed) return;
    disposed = true;
    controller.abort();
    queued = undefined;
    win.cancelAnimationFrame(frame);
    observer.disconnect();
    win.removeEventListener('resize', schedule);
    win.removeEventListener('scroll', schedule, true);
    root.removeEventListener('scroll', schedule, true);
    if (opened)
      void Promise.resolve()
        .then(() => client.close(id))
        .catch(() => undefined);
  }
  /** 失败终止本槽；只有显式重试才能产生新请求。 */
  function fail(failure?: unknown) {
    if (disposed) return;
    const code =
      failure &&
      typeof failure === 'object' &&
      'code' in failure &&
      typeof failure.code === 'string'
        ? failure.code
        : undefined;
    options.status('failed', code);
    destroy();
  }
  /** 同时最多一个尺寸写入和一个最新待写值，慢宿主不会造成积压。 */
  async function flush() {
    if (resizing || disposed) return;
    resizing = true;
    try {
      while (queued && !disposed) {
        const value = queued;
        queued = undefined;
        const key = JSON.stringify(value);
        if (key === sent) continue;
        sent = key;
        await client.resize(id, value.bounds, value.theme);
      }
    } catch (failure) {
      fail(failure);
    } finally {
      resizing = false;
    }
  }
  /** 初次可见时打开，后续只调整；隐藏后发送零尺寸让宿主立即收起。 */
  function measure() {
    frame = 0;
    if (disposed) return;
    const rect = element.getBoundingClientRect();
    const x = Math.max(0, Math.min(win.innerWidth, rect.left));
    const y = Math.max(0, Math.min(win.innerHeight, rect.top));
    const bounds = {
      x,
      y,
      width: Math.max(0, Math.min(win.innerWidth, rect.right) - x),
      height: Math.max(0, Math.min(win.innerHeight, rect.bottom) - y),
    };
    const value = { bounds, theme };
    if (!opened) {
      if (!bounds.width || !bounds.height) return;
      opened = true;
      sent = JSON.stringify(value);
      void Promise.resolve()
        .then(() => {
          if (disposed) return;
          return client.open({ ...options.target, id, ...value }, controller.signal);
        })
        .then(async () => {
          if (disposed) return;
          if (options.target.page === 'login' || options.target.page === 'logout')
            await options.completed(controller.signal);
          else options.status('ready');
        })
        .catch(fail);
    } else {
      queued = value;
      void flush();
    }
  }
  const observer = new ResizeObserver(schedule);
  observer.observe(element);
  win.addEventListener('resize', schedule);
  win.addEventListener('scroll', schedule, true);
  root.addEventListener('scroll', schedule, true);
  options.status('loading');
  schedule();
  return {
    destroy,
    setTheme(value: ThemeName) {
      theme = value;
      schedule();
    },
  };
}
