# @cxx/host-runtime

`@cxx/host-runtime/resource-sources` 提供构建期的纯来源选择器 `selectResourceSource`：接收环境映射、local 工作目录和 Git 仓库，返回经校验的工作目录或分支描述。local/dev/prod 是公共资源环境，与资料隔离和授权环境无关。选择器不执行 Git、安装或构建；工具层负责获取固定提交、缓存及实际公开入口解析，浏览器和安装版消费构建好的资源。

`@cxx/host-runtime/account-authority` 提供 `validateAuthorityProfile`、`validateAuthorityLaunch` 与 `resolveAccountAuthority`。发布者将 `{ edition: 'production', connection: { issuer, websiteOrigin, clientId, redirectUri, postLogoutRedirectUri } }` 写入构建元数据；正式中心使用 HTTPS，回调与中心登记一致。启动时在读取正式定位和迁移前校验版本性质，传入 `packaged`、`mode`、`root`；账户接入时传入同一元数据及可写的 `saved` 配置。正式包拒绝与内置信任不符的覆盖，测试目录参数不改变授权中心。

内部测试包使用 `{ edition: 'test' }`，必须有独立测试根目录，不支持借用旧资料路径；测试连接缺失时给出配置引导，不读取正式配置。测试性质不等于软件资格，仍使用真实认证提供者。外部软件的商品编号固定为其登记 ID，清单中的基建或演示标记不能免除认证；只有宿主内置的公共能力可以不受软件订阅限制。

`@cxx/host-runtime/account` 提供 `createDesktopAccount`：注入认证提供者、可信软件目录、公开连接配置和 Electron 对象，不直接依赖 SaaS SDK。提供者负责标准认证协议，公共宿主负责账户代际、原生窗口、按软件核验和清理。`@cxx/host-runtime/application-access` 是独立的批量资格控制器；状态仅供展示，业务动作前使用 `require(id)`，不把旧允许结果当离线许可。

账户启动或首次读取后，每次后台核对完成再等待 20 秒，整批查询已登记软件。购买、续费和连接恢复发生实际状态变化时通知外壳；关闭商城会立即重核，但不代表已经付款。退出、换号的账户通知包含 `invalidate: true`，界面先撤下旧身份与资格再异步读取，原业务草稿应保留。重复连接失败不循环通知；`destroy()` 释放监测任务。`reasonCode` 是公开的资格分类，界面可据此展示登录、续费或重试入口，不能据此授予业务权限。

`createApplicationHost` 的 `beforeOpen(id)` 在打开和重新激活前核验；`focus(id)` 专供保存、关闭等安全收尾，不触发软件启用。公共基建有独立入口，软件到期不删除资料或关闭未保存页面。

外部工厂会获得限定到本软件的 `access.require()` 与 `access.status()`。外部软件必须在后端动作或安全网关调用 `require()`，不能只校验打开窗口、隐藏按钮或采用展示快照。旧模块不消费该端口时，不能宣称已经完成持续业务门禁接入。

`installHostBridge` 暴露不含令牌的 `cxxHost.account` 传输端口。在渲染上下文调用 `@cxx/host-runtime/account-client` 的 `createAccountClient(window.cxxHost.account)`，再注入公共外壳；取消信号不能直接穿过 Electron 安全桥。登录与取消通过同一请求编号关联，退出未确认保留重试。诊断端口只接收动作及分类码，界面显示登录、查看套餐、续费和重试入口。

支持右侧账户面板的宿主向 `createDesktopAccount` 注入 `windowOf`，只返回请求页面当前所属的活动原生窗口。`account-client.workspace` 接收逻辑页面、请求编号、内容区域和主题，由 cxx-ui 的账户模块统一管理。页面包括登录、退出、商城、官网和偏好；产品不提供 URL、不处理密码，也不复制登录表单。中央认证页和官网使用无 preload、无 Node 权限的独立沙箱视图，主题提示只影响展示。

切换应用、关闭账户面板或销毁所属窗口会释放视图并取消本次认证；迟到结果不能覆盖新页面。不同软件同时登录时保留先发起的页面，并给后来的请求返回可重试引导。面板缩放跟随内容区，隐藏时不覆盖原业务。退出和到期的业务校验继续由中央能力与宿主门禁执行，账户面板不具备授予权限的能力。

独立的 Node/Electron 宿主包。由独立 Shell 仓维护，公开入口不引用 RepoDock、公共 UI、产品 IPC 或全局 Electron 单例。新产品无需修改 `@cxx/ui` / `@cxx/app-shell`，显式接入本包即可；未接入的产品行为不变。

`runtime-environments` 按技术、兼容系列、平台和架构管理公共私有运行环境；`application-runtimes` 为已登记应用创建有限作用域。应用工厂通过注入的 `runtimes.acquire(requirement)` 在首次打开时取得可执行路径，关闭后台后释放租约。系统环境不参与普通用户运行；开发构建工具仍可使用自己的 JDK。Provider 的默认验证器拒绝安装，明确选择的本地分发件受登记摘要与目录边界约束，远程分发必须另行验证可信发布者。

构造或列出模块不会准备环境、加载应用代码或启动后台。兼容应用共用公共安装位置的一份载荷，停用不删除依赖，卸载后 `forget(applicationId)` 解除依赖并清理无人使用的环境；活动租约保留到关闭。环境登记集合一次读取，跨进程准备串行且有期限，不逐应用读取维护文件。完整目录、迁移和测试约束见产品的运行存储接入文档。

公开应用工厂接收 `signal`，应将取消信号传给正在准备的服务。关闭页面或退出宿主时会取消初始化并等待已创建资源释放，再解除环境租约；迟到实例不能重新进入活动集合。新窗口在页面就绪前保持隐藏，由正常聚焦流程展示，避免首次环境准备时出现空窗口。

```js
const {launchOptions,resolveEnvironment,createStorage,createRequestGate}=require('@cxx/host-runtime');
const options=launchOptions(process.argv.slice(1),process.env);
const environment=resolveEnvironment({options,locatorFile,defaultRoot,codeSource,userId});
const storage=createStorage(environment);
const settingsFile=storage.file('settings','common','script-templates','templates.json');
const gate=createRequestGate();
```

`locatorFile` 是当前系统账户的固定定位文件；`defaultRoot` 仅用于初装，程序安装位置不参与数据定位。普通启动进入正式环境，测试启动显式传 `--test-root=<空目录或已有测试环境>`；目录内持久化身份为内核和资料锁的范围。重装后仍读取定位文件，不能重新生成空数据盖住旧环境。

存储采用 `logs|data|settings|plus / common|应用标识 / 模块`。`common` 也是明确的所有者，编辑器、模板等各自使用模块；不能以公共为由共享可并发修改的任意 JSON。一个环境由唯一内核拥有写权限，其他窗口和产品通过能力桥调用。不同测试环境互不连接。

`files` 窄入口的 `writeContents` 和 `writeJson` 复用同一套临时写入、刷盘及原子替换。复制目标与双写目标刷盘失败时不能进入切换阶段，源目录继续有效。

## 接入顺序

1. 在 Chromium 和业务存储初始化前，解析环境并调用 `claimInstance`。重复实例只转交应用标识；不允许同时打开同一个 Chromium 资料。
2. `acquireKernel` 建立按账户与环境隔离的有界本地通信。`sourceId` 表示已验证的兼容宿主构建；不兼容程序不能直接加入。
3. 产品只声明模块路径和旧文件映射。通过 `createMigration` 注入 `activate`、写入屏障、进度通知和有效根目录。成功写入后调用 `committed`，复制阶段继续以源为准。迁移 journal 必须放在随重装保留的账户定位目录。
4. 注册 `ApplicationDescriptor`，为应用设置自己的 preload 与能力白名单。`createElectronViewHost` 只持有窗口与原生视图，`createApplicationHost` 持有应用会话。`merge` 移动原始视图，`mergeWindow` 原子转移整窗，确认接入后关闭空源窗口。`canCombine` 由资格 Provider 注入；资格失效调用 `eligibilityChanged`，后台拆分不阻塞其他应用，恢复资格不自动组合。
5. 目录 Provider 返回有界快照。`createApplicationCenter.plan` 计算升级影响，`createInstallations` 在两个受控槽中准备、验证和切换。默认验证器拒绝安装；接入方必须提供可信来源验证器，不能仅相信下载内容里的哈希。
6. UI 继续从公共控件包组装。设置页、错误引导和真实进度经 DTO 返回，磁盘路径、进程与权限规则不能进入 Renderer。

应用 preload 使用 `installHostBridge` 注入 Electron 和自己的 channel 定义。它只暴露白名单动作、通知和关闭确认；业务权限仍在宿主根据实际 `webContents` 校验，不能相信 Renderer 自报应用标识。`createCloseRequests` 的确认令牌绑定原页面，关闭超时或其他页面应答都拒绝继续。

`destroy` 释放本宿主创建的窗口和视图；不会结束别的环境或系统进程。未知、损坏、离线和权限不足都不会解释为空数据。旧文件只按本次校验清单清理。`prepareBrowserProfile` 在 Chromium 初始化前持有资料锁时复制受控持久模块；新资料成功加载后再调用 `completeBrowserProfile`，不能复制正在使用的数据库。

## 程序安装端口

`snapshotPackage` 为已受信任的程序来源生成摘要清单，不能独立证明发布者身份。`createInstallations` 默认拒绝包，必须注入 `verify`；新程序验证和独立启动探测由 `activate` 端口承担。验证失败保持原活动槽，程序槽按目录持有 `ProgramLease`，不能仅凭同名 `slot-a` 判断不同安装根是否占用。

Electron 对普通 `fs` 有 ASAR 虚拟文件系统适配。复制完整程序及迁移安装根时，应向 `snapshotPackage`、`createInstallations`、`createInstallationLocation` 的 `fileSystem` 注入 `original-fs`，把 `app.asar` 视为物理文件；不修改进程级 `process.noAsar`。公共包本身不加载 Electron。`exclude` 仅允许有界的顶层名称，用于排除原安装器的卸载入口；可信 Provider 必须在快照与安装时使用同一规则。

安装根切换允许活程序继续运行，`createInstallationLocation` 保留有租约的旧目录，调用方在视图关闭或下一次启动时重试 `cleanup`。卸载默认保留数据；`removeData` 和 `clearData` 必须由产品提供明确的所有权清理，不能删除公共目录或项目仓库。

支持安装位置迁移的宿主必须为长期存活的 `createRuntimeEnvironments` 注入 `activeRoot: () => currentInstallationRoot`；`createApplicationRuntimeScope` 使用对应的 `activeInstallationRoot`。函数每次返回唯一登记中的当前安装根，不执行新应用打开检查。存量租约的可执行路径保持原位，释放、依赖移除和后续取得使用当前登记；排他等待后会再次确认位置。省略该函数表示固定安装位置。读取或归属核对失败时保留登记并传播错误，可恢复后重试释放。

## 分发与验证

本包无运行期第三方依赖，支持 CommonJS 主入口及按能力的窄入口，类型声明位于 `index.d.cts`，类型消费者需要标准 Node 类型。产品通过 npm 的本地包依赖消费唯一源码。独立打包使用 `npm pack ./packages/host-runtime --pack-destination <临时归档目录>`，接入方锁定该归档；不能引用产品 `src/main/runtime`。后续集中发布只改变分发地址，不需要更改公开能力接口。

## 独立产品注册与复用内核

产品通过 `application-modules` 注册自己的公开能力入口与独立 preload，注册文件按应用隔离，归属绑定账户和环境。入口与 preload 的内容摘要在加载前重新核对。应用工厂接收明确的 environment、root 和 Electron 能力，返回 load(view) 与 dispose()，不 import 宿主产品的私有实现。

支持从安装位置加入时，在包根目录提供 `cxx-application.json`，或在 `package.json` 中提供相同的 `cxxApplication` 字段：

```json
{"schemaVersion":1,"id":"example-app","name":"示例应用","version":"1.0.0","entry":"desktop/application.cjs","preload":"desktop/dist/host-preload.cjs"}
```

`name/version` 可从所属包清单读取。`installation-discovery.inspectApplication(directory)` 只读取有界声明并校验归属、入口和 preload，不执行程序；`discoverInstallations` 支持源码目录、打包资源区及托管槽，返回 `canAdd/unavailableReason`。桌面宿主旧约定在包内单一适配器转换。确认加入后再调用 `createApplicationModules.register`，启用和资格由宿主应用中心单独持有；扫描或登记本身不能代表已同意启用。

打开时，`resolve` 先重新核对原位置的公开加载声明及摘要。只切换版本、入口、preload 或运行环境声明，即使旧文件仍保留也会返回 `MODULE_CHANGED`；缺少旧文件时先核对新声明，不因旧路径失效而跳过更新流程。没有公开声明的旧式直接登记保留摘要校验兼容；无效、损坏或变成另一应用的声明不会回退加载旧入口。宿主可调用 `review(id)` 只读核对原登记位置，展示名称、版本和位置；确认后调用 `refresh(id, token)`。令牌绑定原登记、新声明、入口、preload 和环境清单，核对期间发生变化会拒绝提交。不能用无条件 `register` 绕过确认，不接受页面指定的新目录。刷新前须关闭该应用并等待后台释放，随后重新装配描述以使用新的 preload；应用数据及启用设置不变。应用代码缓存也应在资源释放后清理，保留程序目录以外的公共依赖，避免更新后继续运行旧代码。

公共内核用 `createHostLauncher(environment)` 登记自己的可执行入口；产品用 `activateHost({environment, applicationId})` 连接同一账户环境。内核已运行只发送激活；未运行则后台启动已登记入口并等待确认，不重建第二套内核。正式环境缺少登记时引导安装基建，不能用空资料代替旧数据。测试必须显式指定独立根目录。

应用页面使用 `preload-bridge` 与 `host-channels` 暴露的窗口和应用白名单，不能取得其他产品的业务桥。公共外壳的 applicationLinks 只展示宿主提供的目录；打开、组合、资格及进程仍由宿主处理。

验证从产品的隔离测试入口运行：`npm run test:core`、`npm run test:architecture`、`npm test`、`npm run test:install`。`npm run test:host` 从临时归档安装到独立消费者，并做严格 TypeScript 检查；`npm run test:package -- <构建目录>` 验证真实程序。正式账户数据不作为测试输入。


application-loader 提供公开惰性应用装配，关闭取消初始化并等待业务 dispose 与运行环境释放；hostContext / processScope 为可选宿主端口，框架不读取产品私有服务。
