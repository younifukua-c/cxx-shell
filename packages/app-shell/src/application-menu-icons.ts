import workspaceIcon from "@cxx/icons/assets/38-workspace.svg";
import processIcon from "@cxx/icons/assets/monitor-activity.svg";
import componentIcon from "@cxx/icons/assets/capability-add.svg";
import linkIcon from "@cxx/icons/assets/resource-link.svg";
import serverIcon from "@cxx/icons/assets/server.svg";
import customerIcon from "@cxx/icons/assets/customer.svg";
const icons: Readonly<Record<string, string>> = {
  "monitor-activity": processIcon,
  "capability-add": componentIcon,
  "resource-link": linkIcon,
  server: serverIcon,
  customer: customerIcon,
};
/** 菜单仅引用中央图标，不复制应用资源。 */
export function applicationMenuIcon(key?: string, parent?: string) {
  return (key && icons[key]) || parent || workspaceIcon;
}
