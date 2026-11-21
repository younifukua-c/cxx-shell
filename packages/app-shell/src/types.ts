import type { MenuItem } from '@cxx/ui';
/** 外壳当前页面归属，临时界面随归属变化清理。 */
export interface ShellView {
  kind: 'app' | 'settings' | 'logs' | 'account' | 'task-cart';
  appId: string;
  settingsId?: string;
}
/** 浏览器无需传入宿主。Electron/Tauri 适配器在产品层实现并清理订阅。 */
export interface WindowHost {
  minimize(): void | Promise<void>;
  toggleMaximize(): boolean | Promise<boolean>;
  close(): void | Promise<void>;
  isMaximized?(): boolean | Promise<boolean>;
  onMaximizedChange?(listener: (maximized: boolean) => void): () => void;
}
/** 账户公共操作属于产品，和应用专属扩展分组显示。 */
export interface ShellAction extends MenuItem {
  run(): void | Promise<void>;
}
