import { defineCentralComponent } from '@cxx/ui/registry';
/** 设置中心：参数、示例与皮肤的公开注册定义。 */
export const settingsCenterRegistration = /* @__PURE__ */ defineCentralComponent({
  id: 'SettingsCenter',
  effect: {
    surface: true,
    "steps": [
      {
        "title": "设置中心在应用内容区域内展示",
        "action": "observe",
        "target": "button"
      },
      {
        "title": "打开设置并保留原工作内容",
        "action": "open",
        "target": "button"
      }
    ]
  },
  name: '设置中心',
  category: '外壳与设置',
  description: '整页覆盖的设置页面，左侧导航，右侧公共或应用配置；账户仅提供设置和帮助。',
  source: '新增设置容器；表单与业务保存接口复用现有组件',
  kind: '新增公共能力',
  props: [
    {
      name: 'open',
      type: 'boolean',
      default: 'false',
      description: '打开状态 / 当前选项，支持 v-model',
    },
    {
      name: 'modelValue',
      type: 'string',
      default: '首项',
      description: '打开状态 / 当前选项，支持 v-model',
    },
    {
      name: 'title',
      type: 'string',
      default: '设置',
      description: '页面名称，也可承载帮助',
    },
    {
      name: 'items',
      type: 'SettingsItem[]',
      default: '必填',
      description: 'id/label/group/description/icon/disabled；分组只出现在设置页',
    },
  ],
  events: ['update:open', 'update:modelValue'],
  slots: ['default({id,item})'],
  tips: [
    '关闭设置保留业务主页面、输入和滚动；原生 dialog 提供焦点约束、Escape 和返回焦点。',
    'CxxShellApp / mountDomShell 自动接入公共外观和日志，产品只登记业务设置。',
  ],
  package: '@cxx/app-shell',
  usage: [
    {
      title: '1. Vue 应用注册',
      text: '账户入口由外壳固定。应用贡献设置项，组件内仍使用 useApplication 访问自己的状态。',
      code: "const app = { id: 'source', name: '源·派生', page: Page, createState: () => ({}),\n  settings: [{ id: 'folders', label: '文件夹配置', component: FolderSettings }] };\n<CxxShellApp :apps=\"[app]\" v-model:theme=\"theme\" />",
    },
    {
      title: '2. 原生 DOM 接入',
      text: '节点保留在文档树，设置页通过 slot 投影；切回应用后草稿仍在，再次进入重新读取。',
      code: "const form = document.createElement('section');\nmountDomShell(host, { apps: [{ id: 'source', name: '源·派生', sidebar, main,\n  settings: [{ id: 'folders', label: '文件夹配置', content: form, onOpen: () => loadForm(form) }] }],\n  onThemeChange: saveTheme, onHelp: openProductHelp, onError: showError });",
    },
    {
      title: '3. 独立设置页面',
      text: '容器只负责导航与覆盖布局；校验、保存和目录选择由产品服务提供。',
      code: '<CxxShellSettings v-model:open="open" v-model="selected" :items="items">\n  <template #default="{ id }"><FolderSettings v-if="id === \'folders\'" /></template>\n</CxxShellSettings>',
    },
  ],
  type: 'vue',
  entry: '@cxx/app-shell',
  exportName: 'CxxShellSettings',
  demo: {
    mode: 'source',
    language: 'vue-sfc',
    source: 'SettingsCenter',
  },
  apiSections: [
    {
      title: 'Vue 应用注册',
      entry: '@cxx/app-shell',
      rows: [
        {
          name: 'ApplicationModule.settings',
          type: 'ApplicationFeature[]',
          default: '[]',
          description: '应用自己的设置页，共享本应用会话与主题',
        },
      ],
    },
    {
      title: '原生应用注册',
      entry: '@cxx/app-shell/dom',
      rows: [
        {
          name: 'DomApplication.settings',
          type: 'DomSettingsSection[]',
          default: '[]',
          description: 'content 原生节点、onOpen 异步读取；不接管持久化',
        },
      ],
    },
  ],
  theme: {
    styles: ['@cxx/ui/style.css', '@cxx/app-shell/style.css'],
  },
});
