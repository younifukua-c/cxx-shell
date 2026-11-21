import fs from "node:fs";
import path from "node:path";
/** 从实际公开导出定位实现，目录变动不会令合同检查静默跳过。 */
export function componentSource(item: {
  package: string;
  exportName?: string;
}): string {
  const directory = path.resolve("packages", item.package.slice(5), "src");
  const barrel = fs.readFileSync(path.join(directory, "index.ts"), "utf8");
  const entry = barrel.match(
    new RegExp("default as " + item.exportName + " \\} from '([^']+)';"),
  );
  if (!entry) throw Error("找不到组件公开实现：" + item.exportName);
  return path.resolve(directory, entry[1]);
}
