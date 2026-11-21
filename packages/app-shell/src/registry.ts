import { defineComponentRegistry } from '@cxx/ui/registry';
import { appShellRegistration } from './components/application-framework/shell/app/registration';
import { settingsCenterRegistration } from './components/application-framework/shell/settings/registration';
import { logCenterRegistration } from './components/application-framework/log/center/registration';
import { fileManageButtonRegistration } from './components/application-components/file-manager/file-manager-button/registration';
import { personalCenterRegistration } from './components/application-framework/shell/account/registration';
/** app-shell 的公开组件注册，文档宿主与消费者共用。 */
export const appShellComponentRegistry = /* @__PURE__ */ defineComponentRegistry([
  appShellRegistration,
  settingsCenterRegistration,
  logCenterRegistration,
  fileManageButtonRegistration,
  personalCenterRegistration,
]);
