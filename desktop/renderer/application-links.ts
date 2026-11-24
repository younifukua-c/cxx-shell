/** 可信主进程提供软件图标；没有品牌资源时保持公共回退，不丢失已提供的图标。 */
export function applicationLinks(
  applications: readonly { id: string; name: string; icon?: string }[],
  fallbackIcon: string,
) {
  return applications.map(({ id, name, icon }) => ({
    id, name, icon: icon || fallbackIcon, accessApplicationId: id,
  }));
}
