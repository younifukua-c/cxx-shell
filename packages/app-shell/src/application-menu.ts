import type { ApplicationSwitcherOption } from "./components/application-framework/shell/app/internal/application-switcher";
/** 每个安装应用仅声明自己拥有的二级功能，一级顺序由宿主目录提供。 */
export interface ApplicationMenuEntry {
  id: string;
  name: string;
  icon?: string;
  navigation?: readonly { id: string; name: string; icon?: string }[];
}
export function projectApplicationMenu(
  catalog: readonly ApplicationMenuEntry[],
  ownerId: string,
  iconFor: (key?: string, parent?: string) => string | undefined = (
    _key,
    parent,
  ) => parent,
  publicEntries: ReadonlySet<string> = new Set(),
) {
  const roots = new Set<string>(),
    routes = new Map<string, { applicationId: string; entryId: string }>(),
    options: ApplicationSwitcherOption[] = [];
  if (!Array.isArray(catalog) || catalog.length > 200)
    throw Error("应用菜单目录无效");
  for (const app of catalog) {
    if (
      !app ||
      typeof app.id !== "string" ||
      !/^[a-z][a-z0-9-]{0,63}$/.test(app.id) ||
      roots.has(app.id) ||
      !app.name
    )
      throw Error("应用菜单目录无效");
    roots.add(app.id);
    const entries = app.navigation?.length
      ? app.navigation
      : [{ id: app.id, name: app.name }];
    if (entries.length > 50) throw Error("应用功能菜单过多");
    const children = new Set<string>();
    for (const entry of entries) {
      if (
        !entry ||
        typeof entry.id !== "string" ||
        !/^[a-z][a-z0-9-]{0,63}$/.test(entry.id) ||
        children.has(entry.id) ||
        !entry.name
      )
        throw Error("应用功能菜单无效");
      children.add(entry.id);
      const value =
        app.id === ownerId
          ? entry.id
          : "__cxx_link__:" + app.id + ":" + entry.id;
      if (app.id !== ownerId)
        routes.set(value, { applicationId: app.id, entryId: entry.id });
      options.push({
        value,
        label: entry.name,
        icon: iconFor(entry.icon, app.icon),
        accessApplicationId:
          app.id === ownerId && publicEntries.has(entry.id) ? null : app.id,
        menuGroup: { id: app.id, label: app.name, icon: iconFor(undefined, app.icon) },
      });
    }
  }
  return { options, routes };
}
