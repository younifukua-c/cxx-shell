import type {PackageManifest,InstallationProgress,ProgramLease} from '../index.cjs';
/** 兼容系列由发布者声明，同系列的应用共享一个环境。 */
export interface RuntimeRequirement {technology:string;compatibility:string;platform:string;arch:string}
/** 租约释放仅解除使用占用，不删除已安装应用仍需的环境。 */
export interface RuntimeLease {key:string;version:string;directory:string;executable:string;release():Promise<void>}
export function environmentKey(requirement:RuntimeRequirement):string;
export interface RuntimeEnvironmentOptions {
 /** 固定安装位置；未注入活动位置读取时持续使用该目录。 */
 root:string;
 /** 从唯一安装登记读取当前位置；清理阶段也必须可读，异常向调用方传播。 */
 activeRoot?():string;
 owner:string;
 provider?:{resolve?(requirement:RuntimeRequirement):Promise<{source:string;manifest:PackageManifest}>;verify?(manifest:PackageManifest):Promise<boolean>};
 onProgress?(value:InstallationProgress):void;
}
/** Provider 只在首次需要缺失的环境时调用；验证器缺省拒绝安装。 */
export function createRuntimeEnvironments(options:RuntimeEnvironmentOptions):{
 acquire(applicationId:string,requirement:RuntimeRequirement):Promise<RuntimeLease>;
 leases():ProgramLease[];
 list():Promise<{key:string;version:string;users:string[]}[]>;
 forget(applicationId:string):Promise<void>;
 remove(requirement:RuntimeRequirement):Promise<unknown>;
};
