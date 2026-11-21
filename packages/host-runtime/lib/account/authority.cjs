'use strict';

const { failure } = require('../files.cjs');
const CONNECTION_KEYS = ['issuer', 'websiteOrigin', 'clientId', 'redirectUri', 'postLogoutRedirectUri', 'requestDevelopmentAccess'];
const LOCAL_CONNECTION = Object.freeze({
    issuer: 'http://127.0.0.1:8080', websiteOrigin: 'http://127.0.0.1:4001',
    clientId: 'cxx-desktop-local', redirectUri: 'http://127.0.0.1:17451/oauth/callback',
    postLogoutRedirectUri: 'http://127.0.0.1:17451/oauth/logout-callback',
});

function invalid(message) { return failure('ACCOUNT_CONFIGURATION_REQUIRED', message); }

/** 接入配置只接受协议字段，不允许夹带本地授权或跳过校验开关。 */
function connection(value, production) {
    if (!value || typeof value !== 'object' || Array.isArray(value)
        || Object.keys(value).some(key => !CONNECTION_KEYS.includes(key))) throw invalid('请核对账户接入配置字段');
    for (const key of ['issuer', 'websiteOrigin', 'redirectUri', 'postLogoutRedirectUri']) {
        let url;
        try { url = new URL(value[key]); } catch { throw invalid('请配置完整的账户服务与回调地址'); }
        const local = ['127.0.0.1', '[::1]'].includes(url.hostname);
        const service = key === 'issuer' || key === 'websiteOrigin';
        if (typeof value[key] !== 'string' || url.username || url.password || url.search || url.hash
            || (url.protocol !== 'https:' && !(local && url.protocol === 'http:' && !(production && service)))
            || (service && url.pathname !== '/')) throw invalid('正式账户服务必须使用HTTPS根地址；原生回调可使用本机回环地址');
    }
    if (typeof value.clientId !== 'string' || !/^[A-Za-z0-9._-]{1,100}$/.test(value.clientId)) throw invalid('请核对公开客户端编号');
    if (value.requestDevelopmentAccess !== undefined && typeof value.requestDevelopmentAccess !== 'boolean') throw invalid('开发权限请求开关必须为布尔值');
    return Object.freeze({ ...value, requestDevelopmentAccess: value.requestDevelopmentAccess ?? (!production && value.clientId === LOCAL_CONNECTION.clientId) });
}

/** 发布者在构建时选择版本性质；启动参数和可写数据不能改变它。 */
function validateAuthorityProfile(profile) {
    if (!profile || !['production', 'test'].includes(profile.edition)
        || Object.keys(profile).some(key => !['edition', 'connection'].includes(key))) throw invalid('安装包缺少有效的授权服务配置，请重新构建或安装');
    if (profile.edition === 'test' && profile.connection !== undefined) throw invalid('测试版本的接入参数应放在独立测试目录');
    return Object.freeze(profile.edition === 'production'
        ? { edition: 'production', connection: connection(profile.connection, true) }
        : { edition: 'test' });
}

/** 在读取定位记录或迁移资料前，拒绝测试包使用正式数据。 */
function validateAuthorityLaunch({ profile, packaged, mode, root }) {
    if (!packaged) return;
    const trusted = validateAuthorityProfile(profile);
    if (trusted.edition === 'test' && (mode !== 'test' || !root)) throw failure('TEST_DIRECTORY_REQUIRED', '此为内部测试版本，请使用测试启动入口并指定独立测试根目录，不支持借用旧资料目录');
}

/** 正式包信任构建时指定的中心；切换资料目录不能切换授权者。 */
function resolveAccountAuthority({ profile, packaged = false, mode, root, saved = {} }) {
    validateAuthorityLaunch({ profile, packaged, mode, root });
    const trusted = profile ? validateAuthorityProfile(profile) : null;
    if (trusted?.edition === 'production') {
        if (!saved || typeof saved !== 'object' || Array.isArray(saved)
            || Object.entries(saved).some(([key, value]) => !CONNECTION_KEYS.includes(key) || value !== trusted.connection[key])) {
            throw invalid('本地账户地址与安装包信任的中心不一致，请移除覆盖配置或安装对应环境的版本');
        }
        return trusted.connection;
    }
    if (mode === 'test' && (!saved || typeof saved.issuer !== 'string')) throw invalid('请在独立测试目录配置测试认证服务，测试启动不会借用正式服务配置');
    return connection({ ...LOCAL_CONNECTION, ...saved }, false);
}

module.exports = { validateAuthorityProfile, validateAuthorityLaunch, resolveAccountAuthority };
