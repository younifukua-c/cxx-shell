import { notificationSettings } from '@cxx/ui/notifications';
import type { LogApplication, LogInput, LogSettings, LogType } from './types';
export const DEFAULT_LOG_TYPES: readonly LogType[] = [
  { id: 'operation', label: '操作日志', group: '通用记录', description: '应用直接提交的通用操作记录' },
  { id: 'error', label: '失败与异常', group: '通用记录', description: '应用报告的操作失败和异常' },
];
export const LOG_RETENTION_DAYS = 30;
export const LOG_RETENTION_DAYS_LIMIT = 3650;
export const LOG_ENTRY_LIMIT = 10000;
export const LOG_PAGE_LIMIT = 200;
export const LOG_DAY_MS = 86400000;
/** 设置录入和存储使用同一保留期限范围。 */
export function retentionDaysError(days: number): string | undefined {
  if (!Number.isInteger(days) || days < 1 || days > LOG_RETENTION_DAYS_LIMIT)
    return `日志保留天数必须为 1 到 ${LOG_RETENTION_DAYS_LIMIT} 的整数`;
}
/** 规范应用目录，拒绝重复类型，避免不同应用设置串用。 */
export function logCatalog(applications: readonly LogApplication[]): LogApplication[] {
  const ids = new Set<string>();
  return applications.map((app) => {
    if (
      typeof app.id !== 'string' ||
      !app.id ||
      app.id.length > 100 ||
      /[\0\r\n]/.test(app.id) ||
      ['__proto__', 'constructor', 'prototype'].includes(app.id) ||
      !app.name ||
      ids.has(app.id)
    )
      throw new Error('日志应用 id 无效或重复');
    ids.add(app.id);
    const types = [
      ...DEFAULT_LOG_TYPES,
      ...(app.logTypes || []).filter((type) => !DEFAULT_LOG_TYPES.some((b) => b.id === type.id)),
    ];
    const seen = new Set<string>();
    for (const type of types) {
      if (!/^[a-z][a-z0-9-]{0,79}$/.test(type.id) || !type.label || seen.has(type.id))
        throw new Error('日志类型无效或重复');
      seen.add(type.id);
    }
    return { id: app.id, name: app.name, logTypes: types.map((type) => ({ ...type })) };
  });
}
/** 默认值只有日志模型持有，页面从宿主读取。 */
export function logSettings(catalog: readonly LogApplication[], raw?: unknown): LogSettings {
  if (raw !== undefined && (!raw || typeof raw !== 'object' || Array.isArray(raw)))
    throw new Error('日志设置格式无效');
  const value = raw as Partial<LogSettings> | undefined;
  if (
    value?.types !== undefined &&
    (!value.types || typeof value.types !== 'object' || Array.isArray(value.types))
  )
    throw new Error('日志类型设置格式无效');
  const days = value?.retentionDays ?? LOG_RETENTION_DAYS;
  const daysError = retentionDaysError(days);
  if (daysError) throw new Error(daysError);
  const types: LogSettings['types'] = {};
  for (const app of catalog) {
    const appTypes = value?.types?.[app.id];
    if (
      appTypes !== undefined &&
      (!appTypes || typeof appTypes !== 'object' || Array.isArray(appTypes))
    )
      throw new Error('应用日志开关格式无效');
    types[app.id] = {};
    for (const type of app.logTypes || []) {
      const enabled = value?.types?.[app.id]?.[type.id] ?? type.defaultEnabled !== false;
      if (typeof enabled !== 'boolean') throw new Error('日志类型开关必须为布尔值');
      Object.defineProperty(types[app.id], type.id, {
        value: enabled,
        enumerable: true,
        writable: true,
      });
    }
  }
  return { retentionDays: days, types, notifications: notificationSettings(value?.notifications) };
}
/** 脱敏常见凭据并限制文本大小；接入方仍须只提交排障所需内容。 */
export function redactLogText(value: string): string {
  return value
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[redacted]@')
    .replace(
      /((?:access[_-]?token|token|password|secret|authorization|api[_-]?key)\s*[=:]\s*)([^\s&,;]+)/gi,
      '$1[redacted]',
    )
    .replace(/Bearer\s+[\w.\-]+/gi, 'Bearer [redacted]')
    .replace(
      /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g,
      '[redacted private key]',
    );
}
export function logInput(catalog: readonly LogApplication[], input: LogInput): Required<LogInput> {
  const app = catalog.find((item) => item.id === input?.appId);
  if (!app || !app.logTypes?.some((type) => type.id === input.type))
    throw new Error('未注册的应用或日志类型');
  const level = input.level ?? 'info';
  if (!['info', 'warning', 'error'].includes(level)) throw new Error('无效日志状态');
  const text = (value: unknown, max: number, required = false) => {
    if (typeof value !== 'string' || value.length > max || (required && !value.trim()))
      throw new Error('日志文本为空或超过长度限制');
    return redactLogText(value);
  };
  return {
    appId: input.appId,
    type: input.type,
    level,
    message: text(input.message, 2000, true),
    scope: text(input.scope ?? '', 2000),
    details: text(input.details ?? '', 16000),
  };
}
