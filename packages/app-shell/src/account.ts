import type { PersonalWorkspaceClient } from './personal-workspace';
export type { PersonalWorkspacePage, PersonalWorkspaceBounds, PersonalWorkspaceTarget, PersonalWorkspaceRequest, PersonalWorkspaceClient } from './personal-workspace';

/** 当前宿主账户的公开摘要，禁止包含凭据或支付私钥。 */
export interface AccountIdentity {
  /** 服务端主体标识，仅用于拒绝切换账户后的迟到结果。 */
  subject: string;
  /** 已验证的展示名称。 */
  displayName: string;
}

/** 软件资料和当前使用资格；安装、启用与商业资格彼此独立。 */
export interface AccountSoftware {
  /** 宿主登记的软件标识。 */
  applicationId: string;
  /** 软件展示名称。 */
  name: string;
  /** 可选的已验证图标资源。 */
  icon?: string;
  /** 服务端配置的使用模式，免费软件不要求有价格或订单。 */
  mode: 'FREE' | 'SUBSCRIPTION' | 'UNAVAILABLE';
  /** 当前服务端使用资格，不作为宿主动作的授权凭证。 */
  allowed: boolean;
  /** 不可用原因的可读说明。 */
  reason: string;
  /** 宿主给出的稳定状态分类，如 LOGIN_REQUIRED、OUTSIDE_ACCESS_PERIOD、NO_SUBSCRIPTION、UNAVAILABLE。 */
  reasonCode?: string;
  /** 已购买套餐的展示名称，无订阅时为空。 */
  planName?: string;
  /** 中央确认的开发资格仅供展示，不属于购买、续费或宿主授权凭证。 */
  accessKind?: 'DEVELOPMENT';
  /** 当前有效使用周期的结束时刻，无覆盖周期时为空。 */
  expiresAt?: string;
  /** 中央返回的订阅开始时刻，仅展示；未返回时不推算购买时间。 */
  startsAt?: string;
}

/** 身份已切换或账户关闭时，先使旧快照失效，再重读；普通周期刷新可省略参数。 */
export interface PersonalAccountChange { invalidate?: boolean }

/** 个人中心只消费宿主窄接口，不知道 HTTP、OAuth、Electron 或账本。 */
export interface PersonalAccountClient {
  /** 可选右侧受信工作区；提供后登录、商城等统一在此承载，不调用旧弹窗入口。 */
  workspace?: PersonalWorkspaceClient;
  /** 读取当前身份及软件摘要；须处理取消，不能返回令牌。 */
  read(signal: AbortSignal): Promise<{ identity: AccountIdentity | null; software: readonly AccountSoftware[]; signOutPending?: boolean; issue?: { code: string; message: string }; currentApplication?: { applicationId: string; allowed: boolean; reason: string; reasonCode?: string } }>;
  /** 账户或资格变化时通知刷新；返回仅释放本次订阅的函数。 */
  onChanged?(listener: (event?: PersonalAccountChange) => void): () => void;
  /** 执行标准登录；取消不切换身份，完成后由界面重新读取。 */
  signIn(signal: AbortSignal): Promise<void>;
  /** 清空本地身份并撤销服务端会话；失败必须明确返回，不能假装退出完成。 */
  signOut(): Promise<void>;
  /** 明确打开商城或所选软件，价格、升级和续费由商城裁决。 */
  openStore(applicationId?: string): Promise<void>;
  /** 打开受信注册入口；缺少服务时由宿主返回明确的恢复提示。 */
  openRegistration?(): Promise<void>;
}
