import { OPEN_TOOL_REQUIRED } from './types';
import type { CopyResult, FileManageClient, OpenResult } from './types';

/** 缺工具配置时要引导的那一组设置。 */
export type ConfigurationGroup = 'editor' | 'opening';

export interface FileManageActionOptions {
  client: FileManageClient;
  /** 缺工具配置时的引导界面；返回 true 表示已配置好，动作才会重试。 */
  configure?(group: ConfigurationGroup): Promise<boolean>;
  onError?(message: string): void;
  onSuccess?(message: string): void;
}

/** 文件管理动作；宿主实现细节与引导流程都收在这里，调用方只给路径。 */
export interface FileManageActions {
  openInFileManager(path?: string): Promise<OpenResult>;
  openWithTool(path?: string): Promise<OpenResult>;
  openDefault(path?: string): Promise<OpenResult>;
  openBuiltIn?(path?: string): Promise<OpenResult>;
  copyPath(path?: string): Promise<CopyResult>;
}

export function createFileManageActions(options: FileManageActionOptions): FileManageActions {
  const { client, configure } = options;
  const onError = options.onError || (() => {});
  const onSuccess = options.onSuccess || (() => {});
  const pending = new Map<string, Promise<OpenResult>>();

  /** 同一个打开动作复用在途请求；配置只引导一次，失败后不循环弹窗。 */
  function open(key: string, invoke: () => Promise<OpenResult>): Promise<OpenResult> {
    const existing = pending.get(key);
    if (existing) return existing;
    const request = (async (): Promise<OpenResult> => {
      try {
        let result = await invoke();
        if (result?.code === OPEN_TOOL_REQUIRED && configure) {
          const ready = await configure(result.configurationGroup || 'editor');
          if (!ready) return { success: false, canceled: true };
          result = await invoke();
        }
        if (!result?.success) throw new Error(result?.error || '打开失败');
        return result;
      } catch (error) {
        const message = (error as Error)?.message || String(error);
        onError('打开失败：' + message);
        return { success: false, error: message };
      }
    })().finally(() => pending.delete(key));
    pending.set(key, request);
    return request;
  }

  return {
    ...(client.openBuiltIn ? { openBuiltIn(path?: string) {
      if (!path) return Promise.resolve({ success: false, error: '没有可打开的路径' });
      return open(`built-in:${path}`, () => client.openBuiltIn!(path));
    } } : {}),
    openInFileManager(path) {
      if (!path) return Promise.resolve({ success: false, error: '没有可打开的路径' });
      return open(`explorer:${path}`, () => client.openInFileManager(path));
    },
    openWithTool(path) {
      if (!path) return Promise.resolve({ success: false, error: '没有可打开的路径' });
      return open(`tool:${path}`, () => client.openWithTool(path));
    },
    openDefault(path) {
      if (!path) return Promise.resolve({ success: false, error: '没有可打开的路径' });
      return open(`default:${path}`, () => client.openDefault(path));
    },
    async copyPath(path) {
      if (!path) return { success: false, error: '没有可复制的路径' };
      try {
        const result = await client.copyPath(path);
        if (!result?.success) throw new Error(result?.error || '复制失败');
        onSuccess('已复制');
        return result;
      } catch (error) {
        const message = (error as Error)?.message || String(error);
        onError('复制失败：' + message);
        return { success: false, error: message };
      }
    },
  };
}
