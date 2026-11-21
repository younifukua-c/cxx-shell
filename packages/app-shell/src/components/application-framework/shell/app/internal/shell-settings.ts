import appearanceIcon from '@cxx/icons/assets/appearance-palette.svg';
import notificationIcon from '@cxx/icons/assets/notification-bell.svg';
import logSettingsIcon from '@cxx/icons/assets/monitor-history.svg';
import folderIcon from '@cxx/icons/assets/file-types/file-folder.svg';
import type { MenuItem } from '@cxx/ui';
import type { SettingsItem } from '../../../../../settings';

/** 公共设置与应用扩展只组合声明，不访问账户或业务数据。 */
export function shellSettingsItems(
  sections: readonly SettingsItem[],
  actions: readonly MenuItem[],
  fileManagement: boolean,
): SettingsItem[] {
  return [
    { id: 'common:appearance', label: '外观', icon: appearanceIcon, group: '公共设置' },
    { id: 'common:notifications', label: '消息提示', icon: notificationIcon, group: '公共设置', contentOwnsScroll: true },
    { id: 'common:logs', label: '日志设置', icon: logSettingsIcon, group: '公共设置', contentOwnsScroll: true },
    ...(fileManagement
      ? [{ id: 'common:folder', label: '文件夹与打开方式', icon: folderIcon, group: '公共设置', contentOwnsScroll: true }]
      : []),
    ...sections,
    ...actions.map((item) => ({
      ...item,
      id: 'action:' + item.id,
      group: item.group || '公共设置',
    })),
  ];
}
