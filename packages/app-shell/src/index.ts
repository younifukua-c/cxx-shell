export { default as CxxShellSettings } from './components/application-framework/shell/settings/CxxShellSettings.vue';
// SettingsNav / SettingsContent 是整页设置的内部两栏（左导航 + 右内容），
// 由 ShellChrome 组合；宿主通过 mountDomShell 的 settingsSections 配置设置项，
// 不需要自己拼这两个件，所以不进公开导出面。
export type { SettingsItem } from './settings';
export * from './logging';
export * from './file-management/index';
export { default as CxxLogCenter } from './components/application-framework/log/center/CxxLogCenter.vue';
export type { LogScope } from './components/application-framework/log/center/CxxLogCenter.vue';
export { default as CxxShellApp } from './components/application-framework/shell/app/CxxShellApp.vue';
export { useApplication, createRuntime, validateApplications } from './runtime';
export type { ApplicationModule, ApplicationFeature, AccountAction, AppRuntime } from './runtime';
export type { ApplicationMenuGroup } from './application-entry';
export type { WindowHost, ShellAction, ShellView } from './types';
export type { PersonalAccountClient, PersonalAccountChange, AccountIdentity, AccountSoftware } from './account';
export type { PersonalWorkspacePage, PersonalWorkspaceBounds, PersonalWorkspaceTarget, PersonalWorkspaceRequest, PersonalWorkspaceClient } from './personal-workspace';
export { default as CxxShellPersonalCenter } from './components/application-framework/shell/account/CxxShellPersonalCenter.vue';
export { mountDomShell, mountDomTitlebar } from './dom';
export type { DomApplication, DomApplicationLink, DomShellOptions, DomSettingsSection } from './dom';

export * from './compatibility';
