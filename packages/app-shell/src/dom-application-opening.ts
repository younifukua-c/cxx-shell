import {nextTick, ref} from 'vue';

/** 隐藏的原生视图不产生动画帧，短定时回退保证已点击的请求仍可继续。 */
function yieldForOpening() {
  return new Promise<void>(resolve => {
    let frame: number | undefined;
    const finish = () => {
      clearTimeout(timer);
      if (frame !== undefined && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
      resolve();
    };
    const timer = setTimeout(finish, 16);
    frame = requestAnimationFrame(finish);
  });
}

interface OpeningOptions {
  nameOf(id: string): string | undefined;
  showApplication(): void;
  onOpen(id: string, entryId?: string): void | Promise<void>;
  onError(error: unknown): void;
}

/** 原生外壳的异步切换：复用请求，只反馈最新选择，销毁后不再发布结果。 */
export function createDomApplicationOpening(options: OpeningOptions) {
  const name = ref<string>();
  const tasks = new Map<string, Promise<void>>();
  let revision = 0, destroyed = false;
  function open(id: string, entryId?: string) {
    if (destroyed) return Promise.resolve();
    const key = JSON.stringify([id, entryId]);
    const current = ++revision;
    name.value = options.nameOf(id);
    options.showApplication();
    let task = tasks.get(key);
    if (!task) {
      task = nextTick()
        .then(yieldForOpening)
        .then(() => {if (!destroyed) return options.onOpen(id, entryId);});
      tasks.set(key, task);
      const release = () => {if (tasks.get(key) === task) tasks.delete(key);};
      void task.then(release, release);
    }
    return task.catch(error => {
      if (!destroyed && current === revision) options.onError(error);
    }).finally(() => {
      if (!destroyed && current === revision) name.value = undefined;
    });
  }
  return {name, open, destroy() {
    destroyed = true;
    revision++;
    tasks.clear();
    name.value = undefined;
  }};
}
