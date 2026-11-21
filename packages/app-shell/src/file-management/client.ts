import { normalizeFileManagementSettings } from './model';
import type { FileManageClient, FileManagementPatch } from './types';

/**
 * 无宿主的回退实现：设置只留在内存里，本机动作明确失败。
 *
 * 与日志的内存客户端同理 —— 它让浏览器里的外壳与文档站也能渲染这一页，
 * 而真正落地本机动作的宿主（Electron）会传入自己的实现。
 */
export function createMemoryFileManageClient(
  initial?: FileManagementPatch,
): FileManageClient {
  let settings = normalizeFileManagementSettings(initial);
  const unavailable = (action: string) => ({
    success: false,
    error: `当前环境不支持${action}`,
  });
  return {
    async getSettings() {
      return normalizeFileManagementSettings(settings);
    },
    async saveSettings(patch) {
      settings = normalizeFileManagementSettings({ ...settings, ...patch });
      return normalizeFileManagementSettings(settings);
    },
    async pickTool() {
      return { success: false, error: '当前环境没有系统选择器' };
    },
    async openInFileManager() {
      return unavailable('在文件管理器中打开');
    },
    async openWithTool() {
      return unavailable('使用配置工具打开');
    },
    async openDefault() {
      return unavailable('按默认方式打开');
    },
    async copyPath() {
      return unavailable('复制路径');
    },
  };
}
