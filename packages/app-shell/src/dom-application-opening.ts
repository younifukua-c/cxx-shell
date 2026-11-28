import {nextTick, ref} from 'vue';

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
        .then(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())))
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
