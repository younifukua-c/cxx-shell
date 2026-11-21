export type ResourceEnvironment = 'local' | 'dev' | 'prod';
export interface ResourceSourceConfiguration {
    /** 资源来源配置协议，与产品版本和数据结构版本独立。 */
    schemaVersion: 1;
    /** local 使用工作目录；dev、prod 分别声明普通 Git 分支。 */
    environments: {
        local: { type: 'workspace' };
        dev: { type: 'git'; branch: string };
        prod: { type: 'git'; branch: string };
    };
}
export type ResourceSource =
    { environment: 'local'; type: 'workspace'; directory: string } |
    { environment: 'dev' | 'prod'; type: 'git'; repository: string; branch: string };
/** 选择公共资源来源；不访问业务资料、不修改仓库，配置非法时抛错。 */
export function selectResourceSource(options: {
    configuration: ResourceSourceConfiguration;
    environment?: ResourceEnvironment;
    workspace?: string;
    repository?: string;
}): ResourceSource;
/** 校验普通 Git 分支，拒绝引用表达式与选项，失败时抛错。 */
export function validateBranch(branch: string): string;
