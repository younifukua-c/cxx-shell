import { uiStyles } from '@cxx/ui/styles';
import shell from './style.css?inline';
import titlebar from './titlebar.css?inline';
import logStyles from './logs.css?inline';
import settingsStyles from './settings.css?inline';
import accountStyles from './account.css?inline';
import fileManageStyles from './file-management.css?inline';

/** 外壳样式只进入自己的 ShadowRoot，业务样式无法覆盖窗口与账户控件。 */
export function mountRoot(host: HTMLElement) {
  const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent =
    uiStyles + '\n' + titlebar + '\n' + shell + '\n' + logStyles + '\n' + settingsStyles + '\n' + accountStyles + '\n' + fileManageStyles;
  const root = document.createElement('div');
  shadow.replaceChildren(style, root);
  return root;
}

