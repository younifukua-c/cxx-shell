export interface AccountAuthorityConnection {
    readonly issuer: string;
    readonly websiteOrigin: string;
    readonly clientId: string;
    readonly redirectUri: string;
    readonly postLogoutRedirectUri: string;
    readonly requestDevelopmentAccess?: boolean;
}
export type AccountAuthorityProfile = Readonly<{ edition: 'test' }> | Readonly<{ edition: 'production'; connection: AccountAuthorityConnection }>;
export declare function validateAuthorityProfile(profile: unknown): AccountAuthorityProfile;
export declare function validateAuthorityLaunch(input: { profile?: unknown; packaged: boolean; mode: string; root?: string }): void;
export declare function resolveAccountAuthority(input: { profile?: unknown; packaged?: boolean; mode?: string; root?: string; saved?: Partial<AccountAuthorityConnection> }): Readonly<AccountAuthorityConnection>;
