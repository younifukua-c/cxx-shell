'use strict';

/** 取消只影响本次界面请求，不将 AbortSignal 传入跨进程安全桥。 */
function cancelled() {
    return Object.assign(new Error('账户操作已取消'), { code: 'LOGIN_CANCELLED' });
}

/** 在渲染上下文适配纯数据桥；认证、资格和窗口仍由可信宿主持有。 */
function createAccountClient(transport) {
    const request = async (action, extra = {}) => {
        const result = await transport.request({ action, ...extra });
        if (!result?.success) throw Object.assign(new Error(result?.error || '请检查账户连接后重试，资料和草稿保留'), { code: result?.code });
        return result.value;
    };
    return Object.freeze({
        workspace: Object.freeze({
            async open(input, signal) {
                if (signal?.aborted) throw cancelled();
                const cancel = () => { void request('account-workspace-close', { id: input.id }).catch(() => {}); };
                signal?.addEventListener('abort', cancel, { once: true });
                try {
                    await request('account-workspace-open', { id: input.id, page: input.page, applicationId: input.applicationId, bounds: input.bounds, theme: input.theme });
                    if (signal?.aborted) throw cancelled();
                } finally { signal?.removeEventListener('abort', cancel); }
            },
            resize: (id, bounds, theme) => request('account-workspace-resize', { id, bounds, theme }),
            close: id => request('account-workspace-close', { id }),
        }),
        async read(signal) {
            if (signal?.aborted) throw cancelled();
            const value = await request('account-read');
            if (signal?.aborted) throw cancelled();
            return value;
        },
        async signIn(signal) {
            if (signal?.aborted) throw cancelled();
            const id = 'login-' + globalThis.crypto.randomUUID();
            const cancel = () => { void request('account-cancel-sign-in', { id }).catch(() => {}); };
            signal?.addEventListener('abort', cancel, { once: true });
            try {
                await request('account-sign-in', { id });
                if (signal?.aborted) throw cancelled();
            } finally { signal?.removeEventListener('abort', cancel); }
        },
        signOut: () => request('account-sign-out'),
        openStore: applicationId => request('account-store', { applicationId }),
        openRegistration: () => request('account-register'),
        onChanged: listener => transport.onChanged(listener),
    });
}

module.exports = { createAccountClient };
