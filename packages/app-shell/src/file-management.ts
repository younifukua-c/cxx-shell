/** 文件管理组合入口；不加载应用外壳或配置弹窗。 */
export { createFileManagerButton, FILE_MANAGE_ICONS, FILE_MANAGE_LABEL } from './file-management/button';
export type { FileManageButtonOptions } from './file-management/button';
export { createFileManageActions } from './file-management/actions';
export type { FileManageActions, FileManageActionOptions } from './file-management/actions';
export type { FileManageClient, OpenResult, CopyResult } from './file-management/types';

/** @deprecated 使用 createFileManagerButton。 */
export { createFileManagerButton as createFileManageButton } from './file-management/button';
