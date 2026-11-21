import { createLogStore, type LogStore } from './store';
import type { LogApplication, LogClient, LogInput, LogSnapshot } from './types';
/** 把同步存储包装成 UI/远程传输共同使用的异步协议。 */
export function createLogClient(store: LogStore): LogClient {
  return {
    catalog: async () => store.catalog(),
    list: async (query) => store.list(query),
    getSettings: async () => store.getSettings(),
    saveSettings: async (settings) => store.saveSettings(settings),
    record: async (input) => store.record(input),
  };
}
/** 无宿主适配器时使用实例隔离的会话日志，关闭产品即释放。 */
export function createMemoryLogClient(applications: readonly LogApplication[]): LogClient {
  let snapshot: LogSnapshot | undefined;
  return createLogClient(
    createLogStore({
      applications,
      storage: {
        read: () => snapshot,
        write: (value) => {
          snapshot = structuredClone(value);
        },
      },
    }),
  );
}
/** 将提交/操作的结果和异常统一记入日志，不因日志写入失败重复执行业务。 */
export async function trackLogOperation<T>(options: {
  client: Pick<LogClient, 'record'>;
  entry: LogInput;
  run: () => Promise<T>;
  /** 处理返回失败 DTO 的接口；抛出的异常始终按失败记录。 */
  outcome?: (result: T) => { success: boolean; details?: string };
  onLogError: (error: unknown) => void;
}): Promise<T> {
  async function record(level: 'info' | 'error', details?: string) {
    try {
      await options.client.record({
        ...options.entry,
        level,
        details: details ?? options.entry.details,
      });
    } catch (error) {
      options.onLogError(error);
    }
  }
  let result: T;
  try {
    result = await options.run();
  } catch (error) {
    await record('error', error instanceof Error ? error.message : String(error));
    throw error;
  }
  const outcome = options.outcome?.(result) || { success: true };
  await record(outcome.success ? 'info' : 'error', outcome.details);
  return result;
}
