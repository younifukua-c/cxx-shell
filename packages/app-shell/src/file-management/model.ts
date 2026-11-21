import type {
  FileManagementPatch,
  FileManagementSettings,
  FileTarget,
  FolderTarget,
  OpeningSettings,
  SuffixRule,
  ToolSettings,
} from './types';

export const DEFAULT_TOOL_SETTINGS: ToolSettings = { command: '', name: '' };
export const DEFAULT_OPENING_SETTINGS: OpeningSettings = {
  folderTarget: 'tool',
  fileTarget: 'system',
  suffixRules: [],
};
export const DEFAULT_FILE_MANAGEMENT_SETTINGS: FileManagementSettings = {
  editor: DEFAULT_TOOL_SETTINGS,
  opening: DEFAULT_OPENING_SETTINGS,
};

/** 缺字段或类型不对的宿主快照补齐成可渲染的设置，界面不必到处判空。 */
export function normalizeFileManagementSettings(
  raw?: FileManagementPatch | null,
): FileManagementSettings {
  const rawEditor = raw?.editor;
  const rawOpening = raw?.opening;
  return {
    editor: {
      command: typeof rawEditor?.command === 'string' ? rawEditor.command : '',
      name: typeof rawEditor?.name === 'string' ? rawEditor.name : '',
    },
    opening: {
      folderTarget: rawOpening?.folderTarget === 'system' ? 'system' : 'tool',
      fileTarget: rawOpening?.fileTarget === 'tool' ? 'tool' : 'system',
      suffixRules: normalizeRules(rawOpening?.suffixRules),
    },
  };
}

/** 只保留带后缀的规则；后缀统一小写，空规则会让最长匹配失去意义。 */
function normalizeRules(rules: unknown): readonly SuffixRule[] {
  if (!Array.isArray(rules)) return [];
  return rules
    .map((rule) => ({
      suffix: String((rule as SuffixRule)?.suffix || '').trim().toLowerCase(),
      opener: String((rule as SuffixRule)?.opener || ''),
    }))
    .filter((rule) => rule.suffix);
}

/** 后缀规则里 opener 的语义：两个约定值之外一律按可执行文件路径处理。 */
export type OpenerKind = 'tool' | 'system' | 'custom';

export function openerKind(opener: string): OpenerKind {
  if (opener === 'tool' || opener === 'system') return opener;
  return 'custom';
}

/** 与 folderTarget / fileTarget 的合法值对应，供界面直接渲染下拉。 */
export const FOLDER_TARGETS: readonly FolderTarget[] = ['tool', 'system'];
export const FILE_TARGETS: readonly FileTarget[] = ['system', 'tool'];
