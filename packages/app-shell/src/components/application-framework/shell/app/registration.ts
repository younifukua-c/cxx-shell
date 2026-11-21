import { defineCentralComponent } from '@cxx/ui/registry';
/** 应用外壳：参数、示例与皮肤的公开注册定义。 */
export const appShellRegistration = /* @__PURE__ */ defineCentralComponent({
  id: 'AppShell',
  effect: {
    surface: true,
    "steps": [
      {
        "title": "应用外壳组织导航、内容和账户入口",
        "action": "observe"
      },
      {
        "title": "窗口功能与页面内容由公共外壳统一布局",
        "action": "observe"
      }
    ]
  },
  name: '应用外壳',
  category: '外壳与设置',
  description: '固定窗栏、切换器和账户入口，应用提供业务区与应用功能页。',
  source: 'window-titlebar/account-bar/view-switch + 公共注册协议',
  kind: '等价重构 + 新增',
  props: [
    {
      name: 'apps',
      type: 'ApplicationModule[]',
      default: '必填',
      description: 'id/name/page/createState；可选 sidebar/sidebarMinWidth/styles/icon/settings/logTypes',
    },
    {
      name: 'initialApp',
      type: 'string',
      default: '首项',
      description: '初始应用 / 账户名',
    },
    {
      name: 'accountName',
      type: 'string',
      default: 'cxx',
      description: '初始应用 / 账户名',
    },
    {
      name: 'account',
      type: 'PersonalAccountClient',
      default: '不接入',
      description: '宿主注入身份、软件和订阅摘要，以及登录、退出、商城和变化订阅；不传令牌。',
    },
    {
      name: 'settingsSections',
      type: 'ApplicationFeature[]',
      default: '[]',
      description: '产品级公共设置页面',
    },
    {
      name: 'commonActions',
      type: 'ShellAction[]',
      default: '[]',
      description: '旧动作兼容入口，收纳到设置页；新功能优先 settingsSections',
    },
    {
      name: 'theme',
      type: 'ThemeName',
      default: 'dark',
      description: '外壳与内部应用统一换肤',
    },
    {
      name: 'themeTokens',
      type: 'ThemeTokens',
      default: '{}',
      description: '外壳与内部应用统一换肤',
    },
    {
      name: 'windowHost',
      type: 'WindowHost',
      default: '—',
      description: '桌面窗口回调；浏览器不传',
    },
  ],
  events: ['appChange(id)', 'error(unknown)', 'update:theme(ThemeName)'],
  slots: [],
  tips: [
    '未注入 account 时账户仅有帮助；注入 PersonalAccountClient 后提供个人中心、我的订阅和逛逛软件。认证及资格判断由宿主负责。',
    '中央分隔线拖曳调整侧栏；各应用、日志和设置独立记忆会话栏宽，双击还原。apps[].sidebarMinWidth 默认 180px，图标导航可配置 72px；设置默认最小 56px。',
    '设置项支持 icon，省略时使用设置图标；窄栏自动显示图标和完整名称提示。',
    '切换时侧栏、页面、应用设置一起切换；应用状态隔离，旧异步结果失效。',
    'Shadow DOM 隔离样式，不作为恶意脚本的安全沙箱。',
  ],
  package: '@cxx/app-shell',
  usage: [],
  type: 'vue',
  entry: '@cxx/app-shell',
  exportName: 'CxxShellApp',
  demo: {
    mode: 'source',
    language: 'vue-sfc',
    source: 'AppShell',
  },
  apiSections: [
    {
      title: '个人中心与软件使用引导', entry: '@cxx/app-shell', rows: [
        { name: 'account', type: 'PersonalAccountClient', default: '不接入', description: 'Vue 与 mountDomShell 共用 read/signIn/signOut/openStore；可订阅 onChanged。只传公开摘要，禁止传令牌和支付密钥。' },
        { name: 'read(signal)', type: 'Promise<AccountSnapshot>', default: '宿主实现', description: '返回当前身份、软件模式、使用资格和期限；currentApplication 指向可信原生页面所属软件。不可用时保留原业务节点与草稿，并给出个人中心、续费和重试入口。' },
        { name: 'signOutPending', type: 'boolean', default: 'false', description: '中心撤销或浏览器退出未确认时显示重试退出；本机身份已清空，不能继续使用旧凭据。' },
        { name: 'showAccount(target?)', type: 'Vue ref / DOM controller', default: '订阅摘要', description: '可选 { page, applicationId } 直接打开个人工作区；无参兼容个人中心，保留原软件节点和草稿。' },
        { name: 'workspace.open(request, signal)', type: 'Promise<void>', default: '可选宿主端口', description: 'page 为 login/logout/store/website/preferences；request 包含唯一 id、可选 applicationId、客户端 CSS bounds 与公共 theme。登录或退出完成才返回，其他页面加载完成返回。' },
        { name: 'workspace.resize(id, bounds, theme)', type: 'Promise<void>', default: '与 open 一起提供', description: '真实右侧内容区的尺寸及皮肤更新；最多一个在途和一个最新待写值，不重新打开页面。' },
        { name: 'workspace.close(id)', type: 'Promise<void>', default: '与 open 一起提供', description: '切页或卸载取消信号并幂等关闭当前请求；旧 id 的迟到关闭不能影响新槽。' },
      ],
    },
    {
      title: '独立窗口外壳', entry: '@cxx/app-shell/titlebar', rows: [
        { name: 'mountDomTitlebar(host, windowHost, onError)', type: '() => void', default: '按需挂载', description: '应用外壳的标题栏适配入口；独立窗口复用同一实现，返回卸载函数，不独立注册组件' },
        { name: 'windowHost', type: 'WindowHost', default: '宿主提供', description: '最小化、最大化、关闭及窗口状态订阅；标题栏不直接访问 Electron' },
      ],
    },
    {
      title: '应用注册与宿主接口',
      entry: '@cxx/app-shell',
      rows: [
        {
          name: 'settings',
          type: 'ApplicationFeature[]',
          default: '应用注册项',
          description:
            'id/label/description/icon/component；在设置页的应用区显示，兼容 accountFeatures',
        },
        {
          name: 'useApplication()',
          type: 'AppRuntime<S>',
          default: '—',
          description: 'state / feature / openFeature(id或null) / runLatest',
        },
      ],
    },
  ],
  theme: {
    styles: ['@cxx/ui/style.css', '@cxx/app-shell/style.css'],
  },
});
