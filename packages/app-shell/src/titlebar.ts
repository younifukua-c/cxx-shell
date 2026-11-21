import { createApp, h } from 'vue';
import { themeStyles } from '@cxx/ui/styles';
import WindowTitlebar from './components/application-framework/shell/app/internal/WindowTitlebar.vue';
import titlebar from './titlebar.css?inline';
import type { WindowHost } from './types';

/** 独立窗口只加载标题栏与主题，不引入应用、设置、日志或项目导航。 */
export function mountDomTitlebar(host: HTMLElement, windowHost: WindowHost, onError: (error: unknown) => void) {
  const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = themeStyles + '\n' + titlebar;
  const root = document.createElement('div');
  shadow.replaceChildren(style, root);
  const application = createApp({
    render: () => h('div', { class: 'cxx-theme' }, h(WindowTitlebar, { windowHost, onError })),
  });
  application.mount(root);
  const boundary = host.parentElement;
  const original = boundary?.getAttribute('data-cxx-dialog-boundary');
  const originalInset = boundary?.style.getPropertyValue('--cxx-dialog-inset-top') || '';
  function measure() {
    if (!boundary) return;
    boundary.setAttribute('data-cxx-dialog-boundary', 'window');
    boundary.style.setProperty('--cxx-dialog-inset-top', Math.max(0, host.getBoundingClientRect().bottom - boundary.getBoundingClientRect().top) + 'px');
  }
  const observer = new ResizeObserver(measure); observer.observe(host); measure();
  return () => {
    observer.disconnect();
    if (boundary) {
      if (original == null) boundary.removeAttribute('data-cxx-dialog-boundary'); else boundary.setAttribute('data-cxx-dialog-boundary', original);
      if (originalInset) boundary.style.setProperty('--cxx-dialog-inset-top', originalInset); else boundary.style.removeProperty('--cxx-dialog-inset-top');
    }
    application.unmount(); shadow.replaceChildren();
  };
}
