import {
  LOG_DAY_MS,
  LOG_ENTRY_LIMIT,
  LOG_PAGE_LIMIT,
  logCatalog,
  logInput,
  logSettings,
} from './model';
import type {
  LogApplication,
  LogInput,
  LogQuery,
  LogSettings,
  LogSnapshot,
  LogStorage,
  LogEntry,
} from './types';
/** 单个宿主持有一个存储实例；每次请求只读一次，修改只原子写一次。 */
export function createLogStore(options: {
  applications: readonly LogApplication[];
  storage: LogStorage;
  now?: () => number;
  id?: () => string;
  /** 宿主可统一资源标识，例如 Windows 路径忽略大小写和分隔符。 */
  scopeKey?: (scope: string) => string;
}) {
  const catalog = logCatalog(options.applications);
  const now = options.now || Date.now;
  const id = options.id || (() => globalThis.crypto.randomUUID());
  const scopeKey = options.scopeKey || ((scope: string) => scope);
  function read(): LogSnapshot {
    const value = options.storage.read() as LogSnapshot | undefined;
    if (value == null) return { version: 1, settings: logSettings(catalog), entries: [] };
    if (value.version !== 1 || !Array.isArray(value.entries) || !value.settings)
      throw new Error('日志存储格式无效，未覆盖原始数据');
    if (
      value.entries.some(
        (entry) =>
          !entry ||
          typeof entry.id !== 'string' ||
          !Number.isFinite(entry.ts) ||
          entry.ts < 0 ||
          entry.ts > 8640000000000000 ||
          !['info', 'warning', 'error'].includes(entry.level) ||
          typeof entry.appId !== 'string' ||
          typeof entry.type !== 'string' ||
          typeof entry.message !== 'string' ||
          (entry.scope !== undefined && typeof entry.scope !== 'string') ||
          (entry.details !== undefined && typeof entry.details !== 'string'),
      )
    )
      throw new Error('日志条目格式无效，未覆盖原始数据');
    return { version: 1, settings: logSettings(catalog, value.settings), entries: value.entries };
  }
  function prune(snapshot: LogSnapshot): LogEntry[] {
    const cutoff = now() - snapshot.settings.retentionDays * LOG_DAY_MS;
    return snapshot.entries
      .filter((item) => item.ts >= cutoff)
      .sort((a, b) => b.ts - a.ts)
      .slice(0, LOG_ENTRY_LIMIT);
  }
  function cleaned(): LogSnapshot {
    const value = read();
    const entries = prune(value);
    if (entries.length !== value.entries.length) options.storage.write({ ...value, entries });
    return { ...value, entries };
  }
  return {
    catalog: () => structuredClone(catalog),
    getSettings: () => structuredClone(cleaned().settings),
    saveSettings(settings: LogSettings) {
      const next = { ...read(), settings: logSettings(catalog, settings) };
      next.entries = prune(next);
      options.storage.write(next);
      return structuredClone(next.settings);
    },
    record(input: LogInput) {
      const entry = logInput(catalog, input);
      const snapshot = read();
      const recorded = snapshot.settings.types[entry.appId]?.[entry.type] !== false;
      if (recorded) snapshot.entries = [{ ...entry, id: id(), ts: now() }, ...snapshot.entries];
      const entries = prune(snapshot);
      if (recorded || entries.length !== snapshot.entries.length)
        options.storage.write({ ...snapshot, entries });
      return { recorded };
    },
    list(query: LogQuery = {}) {
      const { offset = 0, limit = 100 } = query;
      if (
        !Number.isInteger(offset) ||
        offset < 0 ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > LOG_PAGE_LIMIT
      )
        throw new Error(`日志分页范围无效，每页最多 ${LOG_PAGE_LIMIT} 条`);
      if (query.scopes && (!Array.isArray(query.scopes) || query.scopes.length > 200))
        throw new Error('日志资源筛选最多 200 项');
      if (
        query.search !== undefined &&
        (typeof query.search !== 'string' || query.search.length > 2000)
      )
        throw new Error('日志搜索文本无效');
      if (query.scopes?.some((scope) => typeof scope !== 'string' || scope.length > 2000))
        throw new Error('日志资源筛选无效');
      const scopeKeys = query.scopes ? new Set(query.scopes.map(scopeKey)) : undefined;
      const needle = (query.search || '').toLocaleLowerCase();
      const items = cleaned().entries.filter(
        (item) =>
          (!query.appId || item.appId === query.appId) &&
          (!query.type || item.type === query.type) &&
          (!query.level || item.level === query.level) &&
          (!scopeKeys || scopeKeys.has(scopeKey(item.scope || ''))) &&
          (!needle ||
            `${item.message}\n${item.scope || ''}\n${item.details || ''}`
              .toLocaleLowerCase()
              .includes(needle)),
      );
      return { total: items.length, items: structuredClone(items.slice(offset, offset + limit)) };
    },
  };
}
export type LogStore = ReturnType<typeof createLogStore>;
