import { createApp, type App } from 'vue';
import { closeDynamicModal, openDynamicModal } from '@cxx/ui/dom';
import { uiStyles } from '@cxx/ui/styles';
import FileManageSettings from '../components/application-framework/shell/settings/internal/FileManageSettings.vue';
import fileManageStyles from '../file-management.css?inline';
import type { ConfigurationGroup } from './actions';
import type { FileManageClient } from './types';

/** 引导框的稳定标识；缺配置的打开动作共用同一个。 */
const MODAL_ID = 'cxx-file-manage-modal';
const LOAD_FAILED = '打开方式还没加载出来';

interface ConfigureOptions {
  /** 校验不过或保存失败时的提示出口；弹窗本身不关，改完可以直接再试。 */
  onError?(message: string): void;
}

interface FormHandle {
  save(): Promise<boolean>;
  focus(group: ConfigurationGroup): void;
  validate(group: ConfigurationGroup): string;
}

let pending: Promise<boolean> | null = null;

/**
 * 缺工具配置时弹出打开方式表单；保存成功后接着完成那次打开。
 *
 * 与设置页共用同一份表单 —— 两处的字段、默认值与校验不能分叉。
 */
export function configureOpening(
  client: FileManageClient,
  group: ConfigurationGroup = 'editor',
  options: ConfigureOptions = {},
): Promise<boolean> {
  if (pending) return pending;
  pending = show(client, group, options).finally(() => {
    pending = null;
  });
  return pending;
}

function show(
  client: FileManageClient,
  group: ConfigurationGroup,
  options: ConfigureOptions,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    let form: FormHandle | undefined;
    let app: App | undefined;
    const host = document.createElement('div');
    host.className = 'cxx-file-manage-host';
    // 表单放进 Shadow DOM：组件样式与设置页用的是同一份，也不会漏到宿主页面上。
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = uiStyles + '\n' + fileManageStyles;
    const root = document.createElement('div');
    shadow.append(style, root);
    const modal = openDynamicModal({
      id: MODAL_ID,
      title: '设置打开方式',
      body: host,
      onClose: () => {
        app?.unmount();
        if (!settled) {
          settled = true;
          resolve(false);
        }
      },
      actions: [
        { label: '取消', onClick: () => closeDynamicModal(MODAL_ID) },
        {
          label: '保存并打开',
          primary: true,
          disabled: true,
          onClick: async () => {
            if (!form) {
              options.onError?.(LOAD_FAILED);
              return;
            }
            const invalid = form.validate(group);
            if (invalid) {
              form.focus(group);
              options.onError?.(invalid);
              return;
            }
            const primary = modal.querySelector<HTMLButtonElement>('.modal-actions .primary');
            if (primary) primary.disabled = true;
            try {
              // 保存失败时表单自己已提示并保留焦点，弹窗留着不关。
              if (!(await form.save())) return;
              settled = true;
              resolve(true);
              closeDynamicModal(MODAL_ID);
            } finally {
              if (primary) primary.disabled = false;
            }
          },
        },
      ],
    });
    const report = (error: unknown) =>
      options.onError?.(error instanceof Error ? error.message : String(error));
    app = createApp(FileManageSettings, {
      client,
      showSubmit: false,
      // 加载失败时保存会把默认值写回去，所以加载好之前不放行「保存并打开」。
      onReady: () => {
        form?.focus(group);
        const primary = modal.querySelector<HTMLButtonElement>('.modal-actions .primary');
        if (primary) primary.disabled = false;
      },
      onError: report,
    });
    form = app.mount(root) as unknown as FormHandle;
  });
}
