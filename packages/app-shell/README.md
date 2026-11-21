# @cxx/app-shell

可选 `account: PersonalAccountClient` 为 Vue/DOM 外壳提供当前用户名、个人中心、我的订阅和逛逛软件；独立展示使用 `CxxShellPersonalCenter`。宿主提供 `read/signIn/signOut/openStore` 及可选 `onChanged`，不传令牌。预期状态显示登录、套餐、续费、重试和退出重试；不可用软件的原页面及草稿保留，实际业务门禁由宿主及服务端执行。`mountDomShell(...).showAccount()` 可由宿主引导打开统一入口。组件文档为 `#/components/PersonalCenter`。

一个固定外壳装配一个或多个 ApplicationModule。每个模块提供 id/name、可选 sidebar、page、createState、隔离 styles、settings（兼容 accountFeatures）。

账户菜单只有“帮助”，不分类。settings 将配置/模板页登记到整页设置：从左上切换器进入，左侧显示公共设置和当前应用设置，右侧是表单，切回应用即退出。useApplication().openFeature(id) 可直接打开对应设置页。theme/themeTokens 统一应用和设置主题，update:theme 交给产品持久化。

```ts
import { CxxShellApp, useApplication } from '@cxx/app-shell';
import '@cxx/ui/style.css';
import '@cxx/app-shell/style.css';
```

外壳没有项目概念，不依赖 project-kit。业务样式在 Shadow DOM 内；useApplication 提供本应用状态与 runLatest 读取提交门禁。桌面操作由可选 windowHost 适配。完整接入例见仓库 docs/INTEGRATION.md。

所有应用默认有“应用日志”入口，日志设置位于账户“设置”中的公共设置区。应用通过 `logTypes: [{id, label}]` 注册业务类型，通过 `useApplication().recordLog({type,message,level?,scope?,details?})` 提交日志。

外壳的 `logging?: LogClient` 接收宿主适配器；不传时只保存在当前实例内存。`@cxx/app-shell/logging` 提供无 Vue/DOM 依赖的 ESM/CJS 入口，导出 `createLogStore`、`createLogClient`、`trackLogOperation` 和协议类型。宿主负责原子持久化及 IPC，公共模型统一负责分类开关、保留天数、分页和常见凭据脱敏。完整指南及存储示例见仓库 `docs/APPLICATION_LOGS.md`；可操作文档为 `#/components/LogCenter`。
