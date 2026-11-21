/** 设置页的左侧条目；分区只出现在设置页，不进入账户菜单。 */
export interface SettingsItem {
  id: string;
  label: string;
  group?: string;
  description?: string;
  icon?: string;
  disabled?: boolean;
  /** 内容自行滚动时，外壳只分配可用高度，保留内容自己的固定操作区。 */
  contentOwnsScroll?: boolean;
}
