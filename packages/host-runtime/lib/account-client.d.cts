/** 安全桥只传递非秘密摘要、请求编号和可序列化动作。 */
export interface AccountChange {
    /** 账户已退出或切换，接收方先撤下旧身份和资格，再异步读取新状态。 */
    invalidate?: boolean;
}
/** 客户端右侧账户槽位，目标地址只由可信宿主生成。 */
export interface AccountWorkspaceRequest {
    id: string;
    page: 'login' | 'logout' | 'store' | 'website' | 'preferences';
    applicationId?: string;
    bounds: { x: number; y: number; width: number; height: number };
    theme: 'dark' | 'light' | 'glass' | 'neutral' | 'gilded';
}
/** 安全桥只传递非秘密摘要、请求编号和可序列化动作。 */
export interface AccountTransport<Snapshot> {
    /** 请求及失败回执使用纯数据，避免跨桥丢失错误分类。 */
    request(input: Partial<AccountWorkspaceRequest> & { action: 'account-read' | 'account-sign-in' | 'account-cancel-sign-in' | 'account-sign-out' | 'account-store' | 'account-register' | 'account-workspace-open' | 'account-workspace-resize' | 'account-workspace-close' }): Promise<{ success: boolean; value?: Snapshot; code?: string; error?: string }>;
    /** 订阅本机账户变化，返回解除订阅动作。 */
    onChanged(listener: (event?: AccountChange) => void): () => void;
}
/** 在渲染上下文管理取消；不得在 preload 上下文创建后再暴露。 */
export function createAccountClient<Snapshot>(transport: AccountTransport<Snapshot>): {
    workspace: {
        open(input: AccountWorkspaceRequest, signal?: AbortSignal): Promise<void>;
        resize(id: string, bounds: AccountWorkspaceRequest['bounds'], theme: AccountWorkspaceRequest['theme']): Promise<void>;
        close(id: string): Promise<void>;
    };
    read(signal?: AbortSignal): Promise<Snapshot>;
    signIn(signal?: AbortSignal): Promise<void>;
    signOut(): Promise<void>;
    openStore(applicationId?: string): Promise<void>;
    openRegistration(): Promise<void>;
    onChanged(listener: (event?: AccountChange) => void): () => void;
};
