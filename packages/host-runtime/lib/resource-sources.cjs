'use strict';
const path = require('node:path');
const ENVIRONMENTS = ['local', 'dev', 'prod'];
const MAX_BRANCH_LENGTH = 240;

/** 校验普通分支名称，拒绝选项、引用表达式和路径穿越。 */
function validateBranch(branch) {
    if (typeof branch !== 'string' || !branch || branch === '@' || branch.length > MAX_BRANCH_LENGTH
        || /[\x00-\x20\x7f~^:?*\[\\]/.test(branch) || branch.startsWith('-') || branch.startsWith('/')
        || branch.endsWith('/') || branch.includes('..') || branch.includes('@{') || branch.includes('//')
        || branch.split('/').some(part => part.startsWith('.') || part.endsWith('.') || part.endsWith('.lock'))) {
        throw Error('公共资源分支名称无效，请填写普通分支名称');
    }
    return branch;
}

/** 按资源环境选择工作目录或 Git 分支，不读取、推断或改变业务数据环境。 */
function selectResourceSource({ configuration, environment = 'local', workspace, repository }) {
    if (!ENVIRONMENTS.includes(environment)) throw Error('公共资源环境仅支持 local、dev、prod');
    const profile = configuration?.schemaVersion === 1 && configuration.environments?.[environment];
    if (!profile || profile.type !== (environment === 'local' ? 'workspace' : 'git')) throw Error('公共资源来源配置无效');
    if (environment === 'local') {
        if (typeof workspace !== 'string' || !workspace.trim()) throw Error('请指定本机配对的公共资源工作目录');
        return { environment, type: 'workspace', directory: path.resolve(workspace) };
    }
    if (typeof repository !== 'string' || !repository.trim() || repository.startsWith('-') || /[\r\n\0]/.test(repository)) {
        throw Error('请指定有效的公共资源 Git 仓库地址');
    }
    return { environment, type: 'git', repository, branch: validateBranch(profile.branch) };
}

module.exports = { selectResourceSource, validateBranch };
