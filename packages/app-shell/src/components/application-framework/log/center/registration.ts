import { defineCentralComponent } from '@cxx/ui/registry';
/** 应用日志：参数、示例与皮肤的公开注册定义。 */
export const logCenterRegistration = /* @__PURE__ */ defineCentralComponent({
  id: 'LogCenter',
  effect: {
    "steps": [
      {
        "title": "日志按应用和操作类型组织，列表独立滚动",
        "action": "observe"
      },
      {
        "title": "记录一条本地演示日志，查看列表更新",
        "action": "activate",
        "target": "button"
      }
    ]
  },
  name: '应用日志',
  category: '应用日志',
  description: '所有应用默认共享的日志入口、分类筛选、失败记录和日志设置。',
  source: 'RepoDock 操作日志概念 + 新增通用日志模型与存储协议',
  kind: '新增公共能力',
  props: [
    {
      name: 'client',
      type: 'LogClient',
      default: '必填',
      description: 'catalog/list/getSettings/saveSettings/record 异步协议',
    },
    {
      name: 'current',
      type: 'string',
      default: '必填',
      description: '默认应用 / 显示日志设置',
    },
    {
      name: 'settings',
      type: 'boolean',
      default: 'false',
      description: '默认应用 / 显示日志设置',
    },
    {
      name: 'revision',
      type: 'number',
      default: '—',
      description: '外部刷新信号；同条件刷新保留内容、详情和滚动位置',
    },
    {
      name: 'scope',
      type: 'LogScope',
      default: '—',
      description: '由宿主当前选择提供的业务资源范围；等价范围不会重新读取',
    },
  ],
  events: ['close', 'settings', 'error'],
  slots: [],
  tips: [
    '外壳默认提供入口；未提供 logging 时使用实例隔离的内存日志。',
    '筛选栏与分页固定，日志记录独立滚动；搜索合并输入，刷新不重建记录和展开详情。',
    '单应用不显示应用选择器；资源范围由宿主当前选择提供，不再额外显示项目清除行。',
    '持久化宿主使用 @cxx/app-shell/logging（支持 ESM/CJS）；前端只传 LogClient。',
    '默认保留 30 天，最多 10,000 条，分页最多 200 条；缩短保留时长将清理过期记录。',
  ],
  package: '@cxx/app-shell',
  usage: [
    {
      title: '1. 应用注册与提交日志',
      text: '每个应用自动具备操作和错误类型，可再注册业务类型。外壳不要求项目模型。',
      code: "const app = { id: 'source', name: '源·派生', page: Page, createState: () => ({}),\n  logTypes: [{ id: 'git-merge', label: 'Git 合并' }, { id: 'git-create', label: 'Git 新建' }] };\n// 应用组件内\nawait useApplication().recordLog({ type: 'git-create', message: '新建工作区完成' });",
    },
    {
      title: '2. 宿主持久化',
      text: '存储读写失败必须抛错，主进程使用原子写；只持久化一个规范快照。LogClient 可通过白名单 IPC 或 HTTP 连接该存储。',
      code: 'import { createLogStore, createLogClient } from \'@cxx/app-shell/logging\';\nconst store = createLogStore({ applications: [app], storage: {\n  read: () => readSavedSnapshot(), // 首次返回 undefined；损坏抛错\n  write: snapshot => writeAtomically(snapshot),\n} });\nconst client = createLogClient(store);\n// 同进程浏览器产品可直接传；Electron 传 IPC 适配器。\n<CxxShellApp :apps="apps" :logging="client" />',
    },
    {
      title: '3. 成功和失败统一接入',
      text: '接口返回失败 DTO 时提供 outcome；异常自动记失败。日志写入失败由 onLogError 显示，不重复执行已经完成的业务。不要提交密钥或完整环境变量。',
      code: "const result = await trackLogOperation({ client,\n  entry: { appId: 'source', type: 'git-merge', message: '合并分支', scope: workspace },\n  run: () => mergeBranch(),\n  outcome: result => ({ success: result.success === true, details: result.error }),\n  onLogError: error => showLogFailure(error),\n});",
    },
  ],
  type: 'vue',
  entry: '@cxx/app-shell',
  exportName: 'CxxLogCenter',
  demo: {
    mode: 'source',
    language: 'vue-sfc',
    source: 'LogCenter',
  },
  apiSections: [
    {
      title: '应用注册与运行会话',
      entry: '@cxx/app-shell',
      rows: [
        {
          name: 'ApplicationModule.logTypes',
          type: 'LogType[]',
          default: '操作、错误',
          description: '注册额外日志类型；可用 group 分组、description 说明用途；每个应用独立配置',
        },
        {
          name: 'AppRuntime.recordLog',
          type: '(LogInput)=>Promise',
          default: '—',
          description: '自动绑定当前应用 id',
        },
      ],
    },
    {
      title: '日志宿主接口',
      entry: '@cxx/app-shell/logging',
      rows: [
        {
          name: 'createLogStore',
          type: '({applications,storage,now?,id?})',
          default: '—',
          description: '存储、保留时长和分类开关；无 Vue/Node 依赖',
        },
        {
          name: 'trackLogOperation',
          type: '({client,entry,run,outcome?,onLogError})',
          default: '—',
          description: '记录成功、失败 DTO 和异常，保留业务结果',
        },
      ],
    },
  ],
  theme: {
    styles: ['@cxx/ui/style.css', '@cxx/app-shell/style.css'],
  },
});
