import type { ApplicationAccessDecision } from '../application-access.cjs';
import type { AccountWorkspaceRequest } from '../account-client.cjs';

/** 软件信息由可信宿主目录提供，不能从Renderer直接指定基础设施权限。 */
export interface AccountApplication {
  id: string;
  name: string;
  productCode?: string;
  /** 由可信模块目录解析的来源，无来源的外部字段不能替代安装声明。 */
  productCodeSource?: 'manifest' | 'legacy-id';
  infrastructure?: boolean;
  demo?: boolean;
  external?: boolean;
  /** 安装异常的软件不进入资格查询，仍保留自身恢复说明。 */
  unavailable?: {code: string; message: string};
}
/** 认证服务和官网的非秘密固定地址。 */
export interface AccountConnection {
  issuer: string;
  clientId: string;
  redirectUri: string;
  postLogoutRedirectUri?: string;
  websiteOrigin: string;
  /** 是否请求中央允许的管理员开发scope，不能声明本机管理员身份。 */
  requestDevelopmentAccess?: boolean;
}
/** 客户端公开摘要，不能携带原始令牌、支付密钥或认证回调。 */
export interface AccountSnapshot {
  identity: {subject: string; displayName: string} | null;
  signOutPending?: boolean;
  software: {applicationId: string; name: string; mode: 'FREE' | 'SUBSCRIPTION' | 'UNAVAILABLE'; allowed: boolean; reason: string; reasonCode?: string; planName?: string; accessKind?: 'DEVELOPMENT'; startsAt?: string; expiresAt?: string}[];
  issue?: {code: string; message: string};
}
/** 账户及商业服务通过注入端口接入，公共宿主不绑定具体协议厂商。 */
export interface DesktopAccountProvider {
  check(applicationIds: readonly string[], signal?: AbortSignal): Promise<readonly ApplicationAccessDecision[]>;
  snapshot(): AccountSnapshot;
  signIn(signal?: AbortSignal): Promise<void>;
  signOut(): Promise<void>;
  openStore(applicationId?: string): Promise<void>;
  /** 打开受信官网注册入口；旧提供者可不实现。 */
  openRegistration?(): Promise<void>;
  destroy(): void | Promise<void>;
}
/** 原生宿主生命周期，Electron对象只由宿主显式注入。 */
export declare function createDesktopAccount(options: {
  electron: object;
  environment: {id: string};
  configuration: AccountConnection | (() => AccountConnection);
  listApplications(): readonly AccountApplication[];
  /** 只返回当前激活应用所属的原生窗口，后台应用不得覆盖前台页面。 */
  windowOf?: (contents: object) => object | null;
  createProvider(options: {
    configuration: AccountConnection;
    listApplications(): readonly AccountApplication[];
    authorize(request: {url: string; issuer: string; redirectUri: string; signal?: AbortSignal; title?: string}): Promise<string>;
    openStore(url: string): Promise<void>;
    onChanged(): void;
  }): DesktopAccountProvider | Promise<DesktopAccountProvider>;
  onChanged?: (event: {kind: string; applicationIds?: string[]; reason?: string}) => void;
  onDiagnostic?: (event: {operation: string; code: string}) => void;
  /** 可替换调度器用于生命周期验收；生产默认使用宿主定时器。 */
  setTimer?: typeof setTimeout;
  clearTimer?: typeof clearTimeout;
}): {
  status(applicationId: string): {allowed: boolean; reason: string; validUntil?: string | null};
  openWorkspace(owner: object, input: AccountWorkspaceRequest): Promise<void>;
  resizeWorkspace(owner: object, input: Pick<AccountWorkspaceRequest, 'id' | 'bounds' | 'theme'>): void;
  closeWorkspace(owner: object, id: string): void;
  snapshot(): Promise<AccountSnapshot>;
  require(applicationId: string): Promise<void>;
  signIn(signal?: AbortSignal): Promise<void>;
  signOut(): Promise<void>;
  openStore(applicationId?: string): Promise<void>;
  openRegistration(): Promise<void>;
  initialize(): Promise<void>;
  destroy(): Promise<void>;
};
