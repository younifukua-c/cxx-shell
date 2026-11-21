import type { NotificationSettings } from '@cxx/ui/notifications';
/** 每个应用自动具备操作、错误日志，还可注册自己的业务类型。 */
export interface LogType {
  id: string;
  label: string;
  /** 设置页的二级分类标题；未提供时放入“通用记录”。 */
  group?: string;
  /** 简短说明该开关会记录哪些操作。 */
  description?: string;
  /** 高频读取类默认关闭，可按需开启。 */
  defaultEnabled?: boolean;
}
export interface LogApplication {
  id: string;
  name: string;
  logTypes?: readonly LogType[];
}
export type LogLevel = 'info' | 'warning' | 'error';
export interface LogInput {
  appId: string;
  type: string;
  level?: LogLevel;
  message: string;
  /** 业务资源标识，如工作盘路径；不要求应用具有项目概念。 */
  scope?: string;
  details?: string;
}
export interface LogEntry extends LogInput {
  id: string;
  ts: number;
  level: LogLevel;
}
export interface LogSettings {
  retentionDays: number;
  /** 与应用记录开关一起持久化的公共消息偏好。 */
  notifications?: NotificationSettings;
  /** false 停止今后的该类记录；不隐藏已有记录。 */
  types: Record<string, Record<string, boolean>>;
}
export interface LogSnapshot {
  version: 1;
  settings: LogSettings;
  entries: LogEntry[];
}
export interface LogQuery {
  appId?: string;
  type?: string;
  level?: LogLevel;
  search?: string;
  scopes?: readonly string[];
  offset?: number;
  limit?: number;
}
export interface LogPage {
  items: LogEntry[];
  total: number;
}
export interface LogWriteResult {
  recorded: boolean;
}
/** 同步存储由宿主提供：主进程原子文件、浏览器存储或内存均可。读写失败必须抛错。 */
export interface LogStorage {
  read(): unknown;
  write(snapshot: LogSnapshot): void;
}
/** UI 只依赖异步协议，Electron 可经白名单 IPC 实现。 */
export interface LogClient {
  catalog(): Promise<readonly LogApplication[]>;
  list(query?: LogQuery): Promise<LogPage>;
  getSettings(): Promise<LogSettings>;
  saveSettings(settings: LogSettings): Promise<LogSettings>;
  record(input: LogInput): Promise<LogWriteResult>;
  /** 日志地址（日志文件所在目录）。空串表示用宿主默认位置。
   *  它是**存储位置**、不是日志设置的一部分 —— 写进日志快照会自相矛盾（要读快照才知快照在哪），
   *  所以由宿主单独持有。宿主不实现这三个方法时，界面不显示该字段。 */
  getPath?(): Promise<string>;
  savePath?(directory: string): Promise<string>;
  /** 用系统选择器挑一个目录；取消返回空串。地址这一格是路径行（可输入、可浏览），
   *  浏览入口就是这个 —— 宿主不给就只剩"粘贴路径"。 */
  pickPath?(): Promise<string>;
  /** 默认目录（留空时日志落在哪）。界面把它**当实际路径显示出来**，
   *  而不是只说一句"用默认位置" —— 不说清默认是什么，等于让人去猜。 */
  defaultPath?(): Promise<string>;
}
