/** 令牌不会暴露实际路径；resolve 由宿主重新授权并返回当前可读文件。 */
export declare function createFilePreviewResources(options?: { maxResources?: number }): {
    register(owner: string | number, resolve: () => Promise<{ path: string; mime: string }> | { path: string; mime: string }): { token: string; url: string };
    release(owner: string | number, token: string): boolean;
    releaseOwner(owner: string | number): void;
    respond(request: Request): Promise<Response>;
    dispose(): void;
};
