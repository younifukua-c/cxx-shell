import type {RuntimeRequirement,RuntimeLease} from './runtime-environments.cjs';
import type {InstallationProgress,ProgramLease} from '../index.cjs';
import type {ApplicationModule} from './application-modules.cjs';
/** 宿主注入应用专用作用域；activeInstallationRoot 只读当前登记，dispose 释放到该位置。 */
export function createApplicationRuntimeScope(options:{root:string;owner:string;application:ApplicationModule;installationRoot:string;activeInstallationRoot?():string;onProgress?(value:InstallationProgress):void}):{
 acquire(requirement:RuntimeRequirement):Promise<RuntimeLease>;leases():ProgramLease[];dispose():Promise<void>;
};
