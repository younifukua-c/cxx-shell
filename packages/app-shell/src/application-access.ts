import type { AccountSoftware, PersonalAccountClient } from './account';

type Snapshot = Awaited<ReturnType<PersonalAccountClient['read']>>;
type Entry = Pick<AccountSoftware, 'allowed' | 'reason'> & Partial<Pick<AccountSoftware, 'mode' | 'reasonCode'>>;
export interface ApplicationAccessStatus { allowed: boolean; message: string; recovery?: 'account' | 'store' | 'retry' }

/** 一份宿主快照只建一次索引，子模块通过软件标识复用资格，不逐项读取宿主。 */
export function accountAccessIndex(snapshot: Snapshot | undefined): ReadonlyMap<string, Entry> {
  const index = new Map<string, Entry>(snapshot?.software.map(item => [item.applicationId, item]));
  const current = snapshot?.currentApplication;
  if (current) index.set(current.applicationId, { ...index.get(current.applicationId), ...current });
  return index;
}

/** 只呈现宿主资格；未知或过期的付费快照不能作为解锁依据。 */
export function applicationAccess(index: ReadonlyMap<string, Entry>, applicationId: string | null, state: {
  configured: boolean; required?: boolean; verified: boolean; unavailable: boolean; authenticated: boolean;
}): ApplicationAccessStatus {
  if (applicationId === null) return { allowed: true, message: '' };
  if (!state.configured) return state.required
    ? { allowed: false, message: '账户接入尚未完成，请检查账户连接配置。', recovery: 'retry' }
    : { allowed: true, message: '' };
  const item = index.get(applicationId);
  // 明确的免费资格可在连接恢复期间继续使用，未识别的模块不享有此回退。
  if (item?.mode === 'FREE' && item.allowed) return { allowed: true, message: '' };
  if (state.unavailable) return { allowed: false, message: '暂时无法同步使用资格。请检查账户连接后重试，资料和草稿保留。', recovery: 'retry' };
  if (!state.verified) return { allowed: false, message: '正在核对软件使用资格，请稍后或检查连接后重试，原有草稿保留。', recovery: 'retry' };
  if (!item) return { allowed: false, message: state.authenticated
    ? '尚未核实这款软件的使用资格，请查看套餐或重新核对连接。'
    : '请登录账户并核对这款软件的订阅，公共基建和原有草稿保留。', recovery: state.authenticated ? 'store' : 'account' };
  if (item.allowed) return { allowed: true, message: '' };
  const categories: Record<string, { message: string; recovery: 'account' | 'store' | 'retry' }> = {
    LOGIN_REQUIRED: { message: '请登录账户后继续使用这款软件。', recovery: 'account' },
    OUTSIDE_ACCESS_PERIOD: { message: '当前不在订阅有效期内，请查看套餐或续费。', recovery: 'store' },
    NO_SUBSCRIPTION: { message: '尚未订阅这款软件，请查看套餐。', recovery: 'store' },
    UNAVAILABLE: { message: '暂时无法同步使用资格，请检查账户连接后重试。', recovery: 'retry' },
  };
  const classified = /^[A-Z][A-Z0-9_]{0,63}$/.test(item.reason);
  const category = categories[(classified ? item.reason : item.reasonCode) || ''];
  return { allowed: false, message: (classified ? undefined : item.reason) || category?.message || '请登录账户、查看套餐或续费后重新核对使用资格。',
    recovery: category?.recovery || (state.authenticated ? 'store' : 'account') };
}
