/** 宿主接口不加载 Electron；窗口、验证、目录、权限与通知由调用方显式注入。 */
export type StorageCategory='logs'|'data'|'settings'|'plus';
export type FileSystemPort=typeof import('node:fs');
export const runtimeVersion:string;
export function installHostBridge(options:{contextBridge:{exposeInMainWorld(name:string,value:unknown):void};ipcRenderer:{on(channel:string,listener:(event:unknown,value:unknown)=>void):unknown;removeListener(channel:string,listener:(event:unknown,value:unknown)=>void):unknown;invoke(channel:string,value?:unknown):Promise<unknown>};channels:Record<string,string>}):void;
export function prepareBrowserProfile(options:{source:string;target:string;journalFile:string;maxBytes?:number;activate(target:string):void}):{profile:string;journalFile:string};
export function completeBrowserProfile(journalFile:string,options:{source:string;activeProfile:string}):{phase:string;source:string;target:string;failures:{path:string;message:string}[]}|null;
export function createCloseRequests(options:{send(contents:ViewContents,request:{id:string}):void;timeoutMs?:number;limit?:number}):{request(contents:ViewContents):Promise<boolean>;answer(contents:ViewContents,id:string,allow:boolean):boolean;destroy():void};
export interface LaunchOptions {mode:'production'|'test';automated?:boolean;root?:string;isolatedUserData?:string}
export interface Environment {schemaVersion:number;id:string;owner:string;mode:'production'|'test';root:string;layout:string;codeSource?:string;locatorFile?:string;automated?:boolean;browserProfile?:string;instanceLock?:string;legacy?:Record<string,string>}
export interface Storage {readonly environment:Environment;directory(category:StorageCategory,application:string,module:string):string;file(category:StorageCategory,application:string,module:string,file:string):string}
export function launchOptions(args:readonly string[],environment?:Record<string,string|undefined>):LaunchOptions;
export function resolveEnvironment(options:{options:LaunchOptions;locatorFile:string;defaultRoot:string;legacy?:Record<string,string>|null;codeSource:string;userId:string}):Environment;
export function restoreEnvironmentLocation(options:{locatorFile:string;directory:string;userId:string}):{dataRoot:string;environmentId:string;backup:string|null};
export function kernelAddress(environment:Environment,platform?:string):string;
export const CATEGORIES:readonly StorageCategory[];
export function createStorage(environment:Environment):Storage;
export interface Kernel {primary:boolean;address?:string;fingerprint?:string;close():Promise<void>}
export function acquireKernel(environment:Environment,options:{sourceId:string;applicationId?:string;open(applicationId?:string):Promise<void>;platform?:string}):Promise<Kernel>;
export function connect(address:string,request:unknown,timeout?:number):Promise<unknown>;
export interface InstanceApp {setPath(key:string,path:string):void;requestSingleInstanceLock(data:Record<string,unknown>):boolean;releaseSingleInstanceLock():void;on(event:string,listener:(...args:unknown[])=>void):void}
export function claimInstance(options:{app:InstanceApp;runtime:{layout:{profile:string};environment:Environment;sourceId:string};applicationName:string;applicationId?:string;onActivate(error?:Error|null,applicationId?:string):void;listProcesses():ProcessRecord[]}):boolean;
export interface ProcessRecord {pid:number;commandLine?:string;executable?:string}
export interface RequestGate {run<T>(operation:()=>T|Promise<T>):Promise<T>;pause<T>(operation:()=>T|Promise<T>):Promise<T>}
export function createRequestGate(options?:{timeoutMs?:number}):RequestGate;
export interface MigrationMapping {source:string;destination:string}
export function createCleanupRetry(options:{attempt():Promise<MigrationSnapshot|undefined>;delays?:number[]}):{run():Promise<MigrationSnapshot|undefined>;cancel():void};
export interface MigrationSnapshot {id:string;target:string;phase:string;description:string;totalBytes?:number;copiedBytes?:number;fileCount?:number;error?:{code:string;message:string}|null;cleanupFailures?:{path:string;message:string}[]}
export interface Migration {snapshot():MigrationSnapshot|null;prepare(target:string):Promise<MigrationSnapshot>;resume():Promise<MigrationSnapshot>;switch():Promise<MigrationSnapshot>;cleanup():Promise<MigrationSnapshot>;recover():MigrationSnapshot;cancel():MigrationSnapshot;committed(source:string,contents:string|Uint8Array):void;inspectOldCopies():{directory:string;status:'present'|'missing'|'unavailable'}[]}
export function createMigration(options:{journalFile:string;mappings:MigrationMapping[];activate(target:string,id:string):Promise<void>;barrier:RequestGate['pause'];onChange?(value:MigrationSnapshot|null):void;activeRoot?():string;capacity?(target:string):Promise<number|null>;canCleanup?(source:string):true|{directory:string};fileSystem?:FileSystemPort}):Migration;
export interface PackageManifest {id:string;version:string;files:{path:string;sha256:string}[];entry?:string;runtime?:string;signature?:string}
export function snapshotPackage(options:{source:string;id:string;version:string;entry:string;fileSystem?:FileSystemPort;exclude?:string[]}):Promise<PackageManifest>;
export interface InstallationState {active:string|null;version?:string;entry?:string;pending:string|null;pendingVersion?:string;previous?:string|null}
export interface ProgramLease {applicationId:string;slot:string;directory?:string}
export interface InstallationProgress {phase:string;description:string;copiedBytes?:number;totalBytes?:number}
export interface InstallationResult {phase:string;path?:string;status?:string;reason?:string;dataRetained?:boolean}
export function createInstallations(options:{root:string;owner?:string;scope?:'application'|'environment';leases?():ProgramLease[];verify?(manifest:PackageManifest):Promise<boolean>;activate?(id:string,directory:string,manifest:PackageManifest):Promise<void>;onProgress?(value:InstallationProgress):void;fileSystem?:FileSystemPort;exclude?:string[]}):{
 list():Record<string,InstallationState>;prepare(manifest:PackageManifest,source:string):Promise<{id:string;slot:string;version:string;phase:string}>;switch(id:string):Promise<InstallationResult>;cleanup(id:string):InstallationResult;uninstall(id:string,options?:{removeData?:boolean;clearData?(id:string):void}):InstallationResult;
};
export function discoverInstallations(directory:string):Promise<{id:string;name:string;version:string;directory:string;registered:boolean;canAdd:boolean;unavailableReason?:string}[]>;
export function inspectApplication(directory:string):import('./lib/application-modules.cjs').ApplicationModule;
export function createInstallationLocation(options:{root:string;journalFile:string;leases?():ProgramLease[];barrier:RequestGate['pause'];activate(target:string):Promise<void>;activeRoot?():string;onChange?(snapshot:MigrationSnapshot|null):void;fileSystem?:FileSystemPort}):Migration;
export interface ApplicationEntry {id:string;name:string;version:string;installedVersion?:string|null;enabled?:boolean}
export function createApplicationCenter(options:{catalog:{list():Promise<ApplicationEntry[]>};installed:Record<string,{version:string}>;enabled:Set<string>;isCompatible(item:ApplicationEntry,runtimeVersion:string):boolean}):{
 list():Promise<ApplicationEntry[]>;plan(selected?:string[]):Promise<{selected:string[];items:ApplicationEntry[];blocked:{id:string;reason:string}[];restartRequired:boolean}>;
};
export interface SessionInfo {id:string;applicationId:string;windowId:number|string}
export interface ViewContents {id:number;isDestroyed():boolean;close(options:{waitForBeforeUnload:boolean}):void;focus():void}
export interface ApplicationView {webContents:ViewContents;setVisible?(visible:boolean):void}
export interface LiveSession extends SessionInfo {view:ApplicationView;state?:unknown}
export interface ApplicationDescriptor {id:string;name:string;preload?:string;partition?:string;sandbox?:boolean;load(view:ApplicationView):Promise<void>}
export interface ViewHost {createWindow(applicationId:string):number|string|Promise<number|string>;createView(descriptor:ApplicationDescriptor):ApplicationView;attach(session:LiveSession,windowId:number|string):Promise<void>;confirm(session:LiveSession,windowId:number|string):Promise<void>;focus(session:LiveSession,windowId:number|string):Promise<void>;closeEmpty(windowId:number|string):void|Promise<void>;report?(error:Error,session?:LiveSession):void;destroy():void}
export interface ApplicationSessions {list():SessionInfo[];register(input:Omit<LiveSession,'id'>):string;merge(sessionId:string,windowId:number|string):Promise<void>;mergeMany(sessionIds:string[],windowId:number|string):Promise<void>;split(sessionId:string):Promise<void>;eligibilityChanged(allowed:(applicationId:string)=>boolean):void;unregister(id:string):void}
export function createApplicationSessions(options:{viewHost:ViewHost;canCombine?(applicationId:string,windowId:number|string):boolean;persist?(snapshot:SessionInfo[]):void;schedule?(task:()=>Promise<void>):void}):ApplicationSessions;
export interface ApplicationHost {register(descriptor:ApplicationDescriptor):void;unregister(id:string):void;list():SessionInfo[];focus(id:string):Promise<void>;open(id:string,options?:{windowId?:number|string;activate?:boolean}):Promise<SessionInfo>;merge(id:string,windowId:number|string):Promise<SessionInfo>;mergeWindow(sourceWindowId:number|string,targetWindowId:number|string):Promise<void>;split(id:string):Promise<SessionInfo>;closed(view:ApplicationView):void;applicationOf(contents:ViewContents):string|null;contents(id:string):ViewContents|null;eligibilityChanged(allowed:(applicationId:string)=>boolean):void;destroy():void}
export function createApplicationHost(options:{viewHost:ViewHost;applications:ApplicationDescriptor[];beforeOpen?(id:string):Promise<void>;canOpen?(id:string):boolean;canCombine?(id:string,windowId:number|string):boolean;persist?(snapshot:SessionInfo[]):void;onChanged?(snapshot:SessionInfo[],reason:string):void}):ApplicationHost;
/** Electron 类型由宿主版本提供；适配器只使用显式传入的 Electron 对象。 */
export function createElectronViewHost(options:{electron:unknown;windowOptions(applicationId:string):Record<string,unknown>;beforeClose?(contents:ViewContents):Promise<boolean>;onViewClosed?(view:ApplicationView):void;onWindowsChanged?():void;onWindowCreated?(window:unknown):void;onWindowMoved?(window:unknown):void;report?(error:Error):void}):ViewHost & {windowOf(contents:ViewContents|null):unknown;activeWindowOf(contents:ViewContents|null):unknown;windows():unknown[];contents():ViewContents[];window(id:number|string):unknown;dropTarget(source:number,point:{x:number;y:number}):unknown};

export {createApplicationModules,createHostLauncher,validateApplicationModule} from './lib/application-modules.cjs';
export {createRuntimeEnvironments,environmentKey} from './lib/runtime-environments.cjs';
export type {RuntimeRequirement,RuntimeLease} from './lib/runtime-environments.cjs';
export {createApplicationRuntimeScope} from './lib/application-runtimes.cjs';
