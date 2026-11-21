import { createButton, showHoverMenu } from '@cxx/ui/dom';
import type { FileManageActions } from './actions';

/** 文件管理的组合按钮；宿主提供内置编辑器时才显示对应入口。 */
export const FILE_MANAGE_LABEL = '打开';

/** 组合键与菜单项的图标名；图标由宿主的图标目录提供，换目录传 iconBase。 */
export const FILE_MANAGE_ICONS = {
  button: '84-grid-all-yellow.svg',
  fileManager: '06-open-repo.svg',
  tool: '85-wrench-only.svg',
  builtIn: '79-edit.svg',
  copy: '52-copy-yellow.svg',
} as const;

export interface FileManageButtonOptions {
  /** 动作作用的工作盘或项目路径。 */
  path?: string;
  actions: FileManageActions;
  label?: string;
  /** 覆盖组合键图标；只给默认档，悬停/按下由图标状态机制按文件名推。 */
  icon?: string;
  /** 图标所在目录，默认 icons。 */
  iconBase?: string;
  /** 按标准名称解析资源 URL，优先于目录拼接。 */
  resolveIcon?(name: string): string;
  className?: string;
  /** 卡片上的键要点在卡片里但不触发卡片自身的选择。 */
  stopPropagation?: boolean;
  disabled?: boolean;
  onError?(error: unknown): void;
}

/** 原生入口；宿主拿到按钮自己插进卡片或工具栏。 */
export function createFileManagerButton(options: FileManageButtonOptions) {
  const {
    actions, path = '', label = FILE_MANAGE_LABEL, icon, iconBase = 'icons',
    disabled, className, stopPropagation, onError, resolveIcon,
  } = options;
  const iconUrl = (name: string) => resolveIcon?.(name) ?? `${iconBase}/${name}`;
  const button = createButton({
    icon: icon ?? iconUrl(FILE_MANAGE_ICONS.button),
    label,
    className,
    disabled,
    stopPropagation,
    onClick: () => {
      // 没有路径就没有可执行的动作，也不弹一个点了必失败的空菜单。
      if (!path) return;
      // 锚在按钮所在的动作行上：鼠标沿这一行左右移动时菜单不闪，与卡片既有的菜单一致。
      showHoverMenu(
        button.parentElement || button,
        [
          { id: 'file-manager', icon: iconUrl(FILE_MANAGE_ICONS.fileManager), label: '在文件管理器中打开', action: () => actions.openInFileManager(path) },
          { id: 'tool', icon: iconUrl(FILE_MANAGE_ICONS.tool), label: '使用配置工具打开', action: () => actions.openWithTool(path) },
          ...(actions.openBuiltIn ? [{ id: 'built-in', icon: iconUrl(FILE_MANAGE_ICONS.builtIn), label: '内置编辑器', action: () => actions.openBuiltIn!(path) }] : []),
          { id: 'copy', icon: iconUrl(FILE_MANAGE_ICONS.copy), label: '复制路径', action: () => actions.copyPath(path) },
        ],
        { onError },
      );
    },
  });
  return button;
}
