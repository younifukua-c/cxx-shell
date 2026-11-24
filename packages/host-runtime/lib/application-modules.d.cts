import type {Environment} from '../index.cjs';
export interface ApplicationModule {id:string;name:string;version:string;root:string;entry:string;preload:string;/** 中央产品编码，由安装包名解析，与内部ID独立。 */ productCode?:string; /** 安装目录内的品牌图标。 */ iconPath?:string; /** 菜单使用的有界PNG数据。 */ icon?:string; /** 原生窗口使用的安全本地路径。 */ windowIcon?:string;runtimePackages?:string;runtimePackagesDigest?:string;entryDigest?:string;preloadDigest?:string;external?:boolean}
/** 原登记位置的只读更新核对；token 只对应本次看到的程序内容。 */
export interface ApplicationModuleReview {id:string;name:string;previousVersion:string;version:string;root:string;token:string}
export function createApplicationModules(environment:Environment):{
    register(value:ApplicationModule):ApplicationModule;
    /** 仅读取原位置的公开声明与摘要，不加载代码或保存登记。 */
    review(id:string):ApplicationModuleReview;
    /** 再次验证确认令牌；内容变化时抛出 MODULE_REVIEW_EXPIRED，保留原登记。 */
    refresh(id:string,token:string):ApplicationModule;
    unregister(id:string):void;list():ApplicationModule[];resolve(id:string):ApplicationModule;
};
export function validateApplicationModule(value:ApplicationModule):ApplicationModule;
export function createHostLauncher(environment:Environment):{register(value:{executable:string;args?:string[];directory:string;sourceId?:string}):unknown;read():{executable:string;args:string[];directory:string;sourceId?:string}|null};
