import type { CascaderOption, SelectOption } from "@cxx/ui";
import {
  LOGS_ID,
  MESSAGES_ID,
  SETTINGS_ID,
  TASK_CART_ID,
  type ApplicationMenuGroup,
} from "../../../../../application-entry";

export interface ApplicationSwitcherOption extends SelectOption {
  accessApplicationId?: string | null;
  menuGroup?: ApplicationMenuGroup;
}

/** 保持注册顺序，仅将同一应用的多个入口折叠为二级菜单。 */
export function groupSwitcherOptions(
  options: readonly ApplicationSwitcherOption[],
): CascaderOption[] {
  const groups = new Map<string, ApplicationSwitcherOption[]>();
  const usedValues = new Set(options.map((option) => option.value));
  for (const option of options) {
    if (!option.menuGroup) continue;
    const id = option.menuGroup.id;
    const group = groups.get(id) ?? [];
    group.push(option);
    groups.set(id, group);
  }

  const entries: CascaderOption[] = [];
  for (const option of options) {
    const group = option.menuGroup;
    const children = group && groups.get(group.id);
    if (!group || !children) {
      entries.push(option);
    } else if (children[0] === option) {
      let value = `app-group:${group.id}`;
      while (usedValues.has(value)) value = `:${value}`;
      usedValues.add(value);
      entries.push({ value, label: group.label, icon: group.icon, children });
    }
  }
  return entries;
}

/** 公共页面入口由外壳提供，启用任务车时将其与消息收在同一级菜单。 */
export function shellUtilityOptions(
  logIcon: string,
  settingsIcon: string,
  taskCart?: { icon?: string; failures: number },
  fixed = false,
): CascaderOption[] {
  const logs = {
    value: LOGS_ID,
    label: taskCart || fixed ? "消息" : "应用日志",
    icon: logIcon,
  };
  const messages =
    taskCart || fixed
      ? {
          value: MESSAGES_ID,
          label: "应用消息",
          icon: logIcon,
          badge: taskCart?.failures,
          children: [
            logs,
            ...(taskCart
              ? [
                  {
                    value: TASK_CART_ID,
                    label: "任务车",
                    icon: taskCart.icon,
                    badge: taskCart.failures,
                  },
                ]
              : []),
          ],
        }
      : logs;
  return [
    messages,
    { value: SETTINGS_ID, label: "应用设置", icon: settingsIcon },
  ];
}
