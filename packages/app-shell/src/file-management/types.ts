/** 目录的默认打开方式：配置工具或系统文件管理器。 */
export type FolderTarget = 'tool' | 'system';
/** 普通文件的默认打开方式：系统默认程序或配置工具。 */
export type FileTarget = 'system' | 'tool';
/** 后缀覆盖：命中最长后缀时改用该打开方式；opener 为 tool / system，或一个可执行文件路径。 */
export interface SuffixRule {
  suffix: string;
  opener: string;
}
export interface OpeningSettings {
  folderTarget: FolderTarget;
  fileTarget: FileTarget;
  suffixRules: readonly SuffixRule[];
}
/** 「配置工具」：打开规则选工具时使用的 IDE 或编辑器。 */
export interface ToolSettings {
  command: string;
  name: string;
}
/** 文件管理设置：工具与打开规则。工具未配置时 command 为空串。 */
export interface FileManagementSettings {
  editor: ToolSettings;
  opening: OpeningSettings;
}
/** 只给要改的那几项；宿主按组合并进已有设置。 */
export interface FileManagementPatch {
  editor?: Partial<ToolSettings>;
  opening?: Partial<OpeningSettings>;
}
/** 打开结果；工具未配置时回 OPEN_TOOL_REQUIRED，界面据此引导配置后重试。 */
export interface OpenResult {
  success?: boolean;
  code?: string;
  error?: string;
  canceled?: boolean;
  /** 缺哪一组配置：工具本身，还是后缀规则里的指定应用。 */
  configurationGroup?: 'editor' | 'opening';
}
export interface ToolPickResult {
  canceled?: boolean;
  success?: boolean;
  path?: string;
  name?: string;
  error?: string;
}
export interface CopyResult {
  success: boolean;
  error?: string;
}
/** 工具未配置时的约定返回码，宿主与界面共用这一个字面量。 */
export const OPEN_TOOL_REQUIRED = 'OPEN_TOOL_REQUIRED';
/** UI 只依赖异步协议；本机打开、系统选择器与剪贴板由宿主实现。 */
export interface FileManageClient {
  getSettings(): Promise<FileManagementSettings>;
  saveSettings(patch: FileManagementPatch): Promise<FileManagementSettings>;
  /** 用系统选择器挑一个可执行文件；取消时 canceled 为 true。 */
  pickTool(): Promise<ToolPickResult>;
  openInFileManager(path: string): Promise<OpenResult>;
  openWithTool(path: string): Promise<OpenResult>;
  openDefault(path: string): Promise<OpenResult>;
  /** 在当前软件内打开目录编辑器；未提供时不显示此动作。 */
  openBuiltIn?(path: string): Promise<OpenResult>;
  copyPath(path: string): Promise<CopyResult>;
}
