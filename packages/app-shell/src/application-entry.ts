/** 内置入口标识集中定义，应用与宿主链接不能占用。 */
export const LOGS_ID = '__cxx_logs__';
export const SETTINGS_ID = '__cxx_settings__';
export const MESSAGES_ID = '__cxx_messages__';
export const TASK_CART_ID = '__cxx_task_cart__';
export const ACCOUNT_ID = '__cxx_account__';

/** 同一应用的多个导航入口共享这个归属标识。 */
export interface ApplicationMenuGroup {
  id: string;
  label: string;
  icon?: string;
}

/** 校验同一批入口内的分组声明，分组外观与子入口顺序无关。 */
export function validateApplicationMenuGroup(
  group: ApplicationMenuGroup | undefined, groups: Map<string, ApplicationMenuGroup>,
) {
  if (group === undefined) return;
  if (!group || typeof group.id !== 'string' || !group.id.trim()
    || typeof group.label !== 'string' || !group.label.trim()
    || (group.icon !== undefined && typeof group.icon !== 'string')) {
    throw new Error('应用菜单分组的标识、名称或图标无效');
  }
  const icon = group.icon || undefined;
  const previous = groups.get(group.id);
  if (previous && (previous.label !== group.label || previous.icon !== icon)) {
    throw new Error(`应用菜单分组「${group.id}」的名称或图标不一致`);
  }
  if (!previous) groups.set(group.id, { id: group.id, label: group.label, icon });
}

/** 判断入口是否由外壳内置页面保留。 */
export function isReservedApplicationId(id: string): boolean {
  return id === LOGS_ID || id === SETTINGS_ID || id === ACCOUNT_ID || id === MESSAGES_ID || id === TASK_CART_ID;
}
