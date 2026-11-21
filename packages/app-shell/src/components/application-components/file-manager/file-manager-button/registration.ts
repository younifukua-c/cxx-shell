import { defineCentralComponent } from '@cxx/ui/registry';
/** 文件管理按钮组合中央按钮与菜单，文件动作由宿主提供。 */
export const fileManageButtonRegistration = /* @__PURE__ */ defineCentralComponent({
  id: 'FileManageButton',
  effect: {
    surface: true,
    steps: [
      { scene: '文件管理器', title: '同一个路径入口，提供三种实际文件动作', action: 'observe', target: 'button' },
      { title: '打开菜单，选择文件管理器', action: 'open', target: 'button[aria-label="打开"]' },
      { title: '查看文件管理器打开请求的回执', action: 'close', target: '[data-menu-action="file-manager"]' },
      { scene: '配置工具', title: '重新打开菜单，选择配置工具', action: 'open', target: 'button[aria-label="打开"]' },
      { title: '查看配置工具打开请求的回执', action: 'close', target: '[data-menu-action="tool"]' },
      { scene: '复制路径', title: '重新打开菜单，选择复制路径', action: 'open', target: 'button[aria-label="打开"]' },
      { title: '查看复制路径的结果，演示结束', action: 'close', target: '[data-menu-action="copy"]' },
    ],
  }, name: '文件管理按钮', category: '文件管理', type: 'dom',
  package: '@cxx/app-shell', entry: '@cxx/app-shell/file-management', exportName: 'createFileManagerButton',
  description: '把文件管理器打开、配置工具打开和复制路径收在同一个图标入口，供卡片或工具栏接入。',
  props: [
    { name: 'path', type: 'string', default: '空串', description: '动作作用的路径；未提供时不打开菜单' },
    { name: 'actions', type: 'FileManageActions', default: '必填', description: '宿主提供打开与复制动作；组件不读取文件或启动程序' },
    { name: 'label', type: 'string', default: '打开', description: '按钮用途与辅助技术名称' },
    { name: 'icon', type: 'string', default: '内置文件管理图标', description: '入口图标 URL' },
    { name: 'iconBase', type: 'string', default: 'icons', description: '未提供资源解析器时，按目录拼接标准图标名' },
    { name: 'resolveIcon', type: '(name: string) => string', default: '未接入', description: '构建工具或资源库按标准名称返回资源 URL；适合带 hash 的图标资源' },
    { name: 'disabled', type: 'boolean', default: 'false', description: '禁止打开菜单，保留原生禁用语义' },
    { name: 'stopPropagation', type: 'boolean', default: 'false', description: '嵌入卡片时避免同时触发卡片选择' },
    { name: 'className', type: 'string', default: '—', description: '宿主布局定位类，不覆盖中央控件样式' },
    { name: 'onError', type: '(error: unknown) => void', default: '未接入', description: '接收菜单动作失败' },
  ],
  apiSections: [{ title: '文件动作适配', entry: '@cxx/app-shell/file-management', rows: [
    { name: 'createFileManageActions({client,configure,onError,onSuccess})', type: 'FileManageActions', default: '按需', description: '装配动作、缺工具配置引导与错误反馈，同一个打开请求复用在途任务' },
  ] }],
  tips: ['文件管理入口属于应用组件；文件编辑器只编辑文本，不承担系统打开或复制路径。',
    'resolveIcon 与 iconBase 都是图标资源接入方式，前者优先；不修改全局图标表。'],
  theme: { styles: ['@cxx/ui/theme.css', '@cxx/ui/native.css'] },
  demo: { mode: 'source', language: 'vue-sfc', source: 'FileManageButton' },
});
