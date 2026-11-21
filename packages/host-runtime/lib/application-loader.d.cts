import type {Environment,ApplicationDescriptor} from '../index.cjs';
import type {ApplicationModule} from './application-modules.cjs';
/** 已登记应用的惰性加载器；关闭时先取消、再释放业务及运行环境。 */
export declare function createExternalApplications(options: {
 runtime:{environment:Environment}; electron:unknown;
 report?(error:Error):void;
 installationRoot?():string; activeInstallationRoot?():string;
 access?(id:string):unknown; projectAccess?(id:string):unknown;
 hostContext?(id:string):unknown; processScope?(definition:ApplicationModule):unknown;
}):{
 list():ApplicationModule[];
 descriptor(id:string,definition?:ApplicationModule):ApplicationDescriptor;
 initializeProject(id:string,project:unknown,configuration:unknown,signal?:AbortSignal):Promise<unknown>;
 cleanupProject(id:string,project:unknown,taskId:string,signal:AbortSignal,progress?:(completed:number,total:number)=>void):Promise<unknown>;
 closed(id:string):Promise<void>; waitClosed():Promise<void>; destroy():Promise<void>;
};
