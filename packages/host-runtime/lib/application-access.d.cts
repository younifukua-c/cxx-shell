/** 服务端判定，仅用于短时展示；业务动作仍须重新调用require。 */
export interface ApplicationAccessDecision {
  applicationId: string;
  allowed: boolean;
  reason: string;
  evaluatedAt: string;
  validUntil: string | null;
}
/** 宿主注入的软件资格端口，不依赖特定认证或支付厂商。 */
export interface ApplicationAccessProvider {
  check(applicationIds: readonly string[], signal: AbortSignal): Promise<readonly ApplicationAccessDecision[]>;
}
/** 账户重置、资格复核和关闭的独立生命周期。 */
export declare function createApplicationAccess(options: {
  provider: ApplicationAccessProvider;
  onChanged?: (applicationIds: string[], reason: string) => void;
  now?: () => number;
  setTimer?: typeof setTimeout;
  clearTimer?: typeof clearTimeout;
}): {
  status(applicationId: string): {allowed: boolean; reason: string; validUntil?: string | null};
  /** 单批与总展示容量均有界；旧记录淘汰后仅能重新核验，不能离线授权。 */
  refresh(applicationIds: readonly string[]): Promise<void>;
  require(applicationId: string): Promise<void>;
  reset(): void;
  destroy(): void;
};
