# @cxx/app-shell

## 0.29.0

- 统一安装应用目录及二级功能，公开菜单投影、跨应用功能打开与宿主导航恢复接口。

## 0.28.3

- 切换软件时保留菜单和窗栏，使用公共骨架并隔离重复、失败及迟到请求。

## 0.28.2

### Patch Changes

- 独立 Shell 与业务产品统一消费 UI 1.44.2 的目录焦点、动作呈现修复；依赖元数据变更使用新归档版本，保留旧包。

## 0.27.20

### Patch Changes

- UI新增接口升至1.44.0后，app-shell及project-kit包内dependencies范围改变；sync诊断app-shell status=compared samePackageVersion=true changedFields=[dependencies]。使用新patch保存不可变归档，禁止覆盖既有版本。

## 0.27.19

### Patch Changes

- 当前UI升为1.43.5，宿主包归档依赖范围随UI变化。同步诊断app-shell status=compared samePackageVersion=true changedFields=dependencies，禁止覆盖既有归档；project-kit同样依赖UI，需要新的包身份。

## 0.27.18

### Patch Changes

- 归档清单 compared/samePackageVersion=true，dependencies 从 @cxx/ui ^1.43.3 变为 ^1.43.4；为包内依赖内容变化分配新版本，保留旧归档。

## 0.27.17

### Patch Changes

- UI 1.43.3 升级使两个依赖包的归档 dependencies 从 ^1.43.2 改为 ^1.43.3；sync Archive manifest diagnostic status=compared samePackageVersion=true changedFields=[dependencies]（app-shell），project-kit 同样声明 workspace:^ UI，需新版本保留既有不可覆盖归档。仅集成元数据。

## 0.27.16

### Patch Changes

- 同步诊断 status=compared、samePackageVersion=true、changedFields=[dependencies]；app-shell 0.27.15 包内 @cxx/ui 由 ^1.43.1 变为 ^1.43.2，旧归档不可覆盖，为实际依赖内容变化分配中央patch。

## 0.27.15

### Patch Changes

- 中央 UI 1.43.1 改变 workspace:^ 在归档内解析的 dependencies 范围；app-shell 同版本归档诊断 status=compared samePackageVersion=true changedFields=[dependencies]，project-kit 同样直接依赖 workspace:^ UI，须以新版本保留既有归档不可覆盖。

## 0.27.14

### Patch Changes

- 同步诊断 status=compared,samePackageVersion=true,changedFields=[dependencies]，@cxx/ui 范围从 ^1.42.0 变为 ^1.43.0，必须保留不可覆盖的0.27.13旧归档。

## 0.27.13

### Patch Changes

- 归档诊断status=compared,samePackageVersion=true,changedFields=[dependencies]：app-shell 0.27.12包内@cxx/ui范围^1.41.0→^1.42.0，不覆盖既有归档，分配新patch。

## 0.27.12

### Patch Changes

- 归档不可覆盖诊断 status=compared samePackageVersion=true changedFields=dependencies：app-shell 0.27.11 的包内UI范围由^1.40.0变^1.41.0，须新patch保存依赖内容变化。

## 0.27.11

### Patch Changes

- 归档诊断status=compared、samePackageVersion=true、changedFields=[dependencies]；app-shell0.27.10包内UI范围^1.39.0变^1.40.0，既有同版本归档不可覆盖。

## 0.27.10

### Patch Changes

- 294cf92: 分组菜单提供与设置导航一致的侧栏呈现方式，统一字号、行高与自适应留白；设置入口复用同一导航。
- Updated dependencies [294cf92]
  - @cxx/ui@1.39.0

## 0.27.9

### Patch Changes

- 本批UI patch将1.38.2推进1.38.3；两个消费者仍声明workspace:^，已交付包内基线为^1.38.2，下一版打包将改变该依赖清单。因此同时协调受影响消费者的独立patch，最终归档及仓外消费验证后再交付，旧归档不覆盖。
- Updated dependencies [0933ea2]
  - @cxx/ui@1.38.3

## 0.27.8

### Patch Changes

- UI1.38.2使两个公共包内解析的UI依赖由^1.38.1变为^1.38.2；只读归档清单已核实真实内容差异，为新组合分配独立补丁版本，不覆盖既有同版本归档。

## 0.27.7

### Patch Changes

- UI升级至1.38.1后，workspace:^打包解析使AppShell与ProjectKit包内UI依赖从^1.38.0变为^1.38.1；既有归档只有package.json变化。为这套必要依赖组合分配独立补丁版本，保留已集成旧归档不覆盖。

## 0.27.6

### Patch Changes

- 本批 @cxx/ui@1.38.0 附着标签进入上层包的构建依赖图；test:consumer c4da334 已通过但 cxx_sync_dependencies 明确拒绝 cxx-app-shell-0.27.5.tgz 同版本不同内容。上层 app-shell/project-kit 构建内联 UI，需分配新 patch 归档以保留旧版本不可变性，不改业务实现。绑定来源 b1a199757fafd86db75a2448ff4067208cb4007c。

## 0.27.5

### Patch Changes

- 本事件中央 UI 1.37.2 重建使公开宿主包归档内容变化；同步明确拒绝覆盖已集成 cxx-app-shell-0.27.4.tgz。为保留不可覆盖档案并统一本次消费依赖，分配必要集成patch，不修改业务实现。

## 0.27.4

### Patch Changes

- 本事件中央 @cxx/ui 1.37.1 更新后，消费该 workspace 依赖的归档包清单/构建内容变化；sync_dependencies 已拒绝覆盖 cxx-app-shell-0.27.3.tgz。为同一中央SHA依赖组合分配新归档版本，保留不可覆盖旧档，仅必要版本元数据，不改业务。

## 0.27.3

### Patch Changes

- 必要集成版本：UI Changeset 已升级到 1.37.0；app-shell 与 project-kit 均声明 @cxx/ui workspace:^，重新打包会写入新的实际依赖范围，故归档内容变化。cxx_sync_dependencies 实际拒绝 cxx-app-shell-0.27.2.tgz Immutable archive version conflict。对两个直接消费 UI 的公开包分配新 patch，保留已集成归档，业务源码不改。授权：聊天 01a1626c-7c9d-7842-a91a-c530c45f1994「你以后合并完更新产品依赖,并且起一下,比如当前是repodisk,install依赖然后start」。

## 0.27.2

### Patch Changes

- Updated dependencies [4bff707]
- Updated dependencies [fcf6879]
- Updated dependencies [11cf92f]
- Updated dependencies [2947bc7]
  - @cxx/ui@1.36.0
  - @cxx/icons@0.7.0

## 0.27.1

### Patch Changes

- 本事件中央 UI 1.35.0 已通过外部消费，sync_dependencies 实际拒绝 cxx-app-shell-0.27.0.tgz 同版本不同内容。app-shell 与 project-kit 的 workspace UI 依赖在归档中展开为新版本，须各自 patch 分配不可覆盖的新归档，保留既有归档，不修改实现。依据用户本回合流程第4、7项。

## 0.27.0

### Minor Changes

- 4e65466: 新增按目录展开读取的文件夹编辑器，统一编辑、草稿保护和图标工具栏；动态弹窗支持异步关闭校验。文件打开菜单可由宿主注册内置编辑器入口。

### Patch Changes

- Updated dependencies [4e65466]
  - @cxx/ui@1.34.0

## 0.26.0

### Minor Changes

- cf2e454: 级联菜单支持鼠标经过展开。应用外壳提供独立任务车页面与侧栏排序焦点模式，项目列表支持在排序时聚焦拖曳手柄。

### Patch Changes

- Updated dependencies [cf2e454]
  - @cxx/ui@1.29.1

## 0.25.0

### Minor Changes

- d29b7c2: 级联菜单支持数量徽标，DOM 应用外壳可以在应用消息下挂载任务车并显示待处理数量。

### Patch Changes

- Updated dependencies [73cc121]
- Updated dependencies [d29b7c2]
- Updated dependencies [73cc121]
  - @cxx/ui@1.28.0

## 0.24.0

### Minor Changes

- eb293ed: 日志设置只滚动正文，保存区独立固定。编辑器设置接入时通过公开的 `contentOwnsScroll` 选项把滚动交给看板表单，升级步骤见设置中心文档。修正必填标记和校验动画，保持原生选择控件的自然尺寸，并让打开的下拉面板跟随触发器重排。

  原生表单可把独立字段规则绑定到复合控件已有的输入，并按字段触发校验。限值控件公开 `commit`，供宿主在保存时确认正在编辑的数值。

### Patch Changes

- Updated dependencies [eb293ed]
  - @cxx/ui@1.26.0

## 0.23.3

### Patch Changes

- 2f6ce4c: 文件编辑器配置使用看板表单的独立保存区。设置外壳允许嵌入表单管理正文滚动，使保存按钮始终可见且滚动条在操作区上方结束。
- Updated dependencies [2f6ce4c]
  - @cxx/ui@1.23.2

## 0.23.2

### Patch Changes

- a448396: 公共设置使用同一右侧滚动区和保存位置。文件编辑器配置始终显示保存按钮，有修改时启用。
- Updated dependencies [a448396]
- Updated dependencies [a8ae9c9]
  - @cxx/ui@1.23.0

## 0.23.1

### Patch Changes

- 7da6f53: 拒绝同一应用分组 ID 的冲突名称和图标。父级外观与子入口顺序无关，更新失败时保留现有菜单。
- 01e1601: 编辑器配置的保存操作悬浮在表单滚动区内。公共设置沿用日志设置的表单宽度、标题间距和滚动留白。
- Updated dependencies [01e1601]
- Updated dependencies [6ccc7e8]
  - @cxx/ui@1.22.2

## 0.23.0

### Minor Changes

- 43b06f7: 新增级联选择器 CxxCascader。应用外壳支持按注册分组合并同一应用的多个菜单入口，单入口仍可直接打开。

### Patch Changes

- Updated dependencies [43b06f7]
- Updated dependencies [9833ed1]
- Updated dependencies [402c970]
  - @cxx/ui@1.22.0

## 0.22.1

### Patch Changes

- 56e233f: 日志设置保留应用级折叠，应用内的记录分类使用始终展开的标题和复选框。
- e5f9295: 在日志设置的相邻二级分组之间增加细分隔线和留白。
- 81aedeb: 修复桌面日志设置的保存对勾无法加载，随组件提供标准四态图标资源。
- 27e10f7: 给日志设置正文与右侧滚动条之间留出间距。
- 56e233f: 提供可嵌入指定区域的看板表单，统一标题、取消、正文滚动及底部保存。字段校验显示必填标记、边框动画和逐字段错误，并定位首个错项。项目与设置复用同一布局。
- cc1de70: 从账户菜单和个人工作区侧栏移除「我的偏好」入口。
- d4c94d3: 将个人工作区的返回入口移到左侧标题旁，使用切换图标及悬停说明，点击后恢复进入前的页面。
- 1c8b7cb: 日志设置和消息提示只滚动表单正文，滚动条贴近字段，保存操作独立显示在正文下方。
- Updated dependencies [713de5d]
- Updated dependencies [b879811]
- Updated dependencies [899b510]
- Updated dependencies [3a955db]
- Updated dependencies [56e233f]
- Updated dependencies [56e233f]
- Updated dependencies [72afcc5]
- Updated dependencies [0263ecf]
- Updated dependencies [fe70009]
  - @cxx/ui@1.21.0

## 0.22.0

### Minor Changes

- e3792df: 日志类型支持登记分组及简短说明，设置页复用分组菜单，展开后再配置记录开关，并保留各应用的独立设置。
- 2fd659e: 公共消息设置使用限值输入选择不弹出、定时关闭或一直显示。旧设置的秒数和常驻含义继续生效，关闭弹出时仍按日志配置处理记录。

### Patch Changes

- Updated dependencies [4b9d7b5]
- Updated dependencies [2fd659e]
- Updated dependencies [2fd659e]
- Updated dependencies [d731c10]
  - @cxx/ui@1.20.0

## 0.21.0

### Minor Changes

- c80d018: 原生应用外壳支持在应用选择器下方放置当前应用的固定操作区。项目导航可将现有创建入口渲染到该区域，避免入口与列表重复留白。

## 0.20.2

### Patch Changes

- 45e13c4: 组件注册自动生成参数、方法、事件与插槽预演，并支持为专用场景覆盖示例和播放步骤。
- 9b5f978: 修复小窗口中预演舞台被裁切、星空箭头资源就绪前的空图标，以及全屏加载预演越出舞台的问题。补充弹窗、交互卡片、骨架屏和目录树参数的实际效果，并添加覆盖全部登记组件和 API 的浏览器预演检查。

  日志设置的保存图标通过公共图标库解析，文档示例与应用均可显示。

- Updated dependencies [45e13c4]
- Updated dependencies [f62b412]
- Updated dependencies [a12ba78]
- Updated dependencies [e62de04]
- Updated dependencies [7d7145a]
- Updated dependencies [ea6d985]
- Updated dependencies [4ad91bf]
- Updated dependencies [6741716]
- Updated dependencies [a97953d]
- Updated dependencies [0e5215e]
- Updated dependencies [9b5f978]
  - @cxx/ui@1.19.0

## 0.20.1

### Patch Changes

- 2c9ea14: 应用切换器只显示当前窗口实际激活的软件；外部软件入口、锁定选择及打开失败不会把原页面标为其他软件。

## 0.20.0

### Minor Changes

- 1ff4f52: 个人工作区复用左右布局，左栏显示个人分组，右侧提供明确返回；集中导航状态与受信菜单映射，保留业务节点、设置草稿和日志筛选，返回前撤下旧付费资格展示并重新核验。设置内容、账户菜单和权限恢复提示拆为共享组件。

### Patch Changes

- 78ff4c1: 个人工作区按页面区分官网与认证连接失败，官网离线时保留身份、草稿和显式重试入口。

## 0.19.6

### Patch Changes

- 统一集成账户工作区和资格恢复能力，分配独立归档版本并更新内部依赖。
- Updated dependencies
  - @cxx/ui@1.18.1

## 0.19.5

### Patch Changes

- 认证回跳与资格通知重叠时等待最新身份核对，避免已完成退出仍停在失败面板。

## 0.19.4

### Patch Changes

- 当前软件裁决返回到期等稳定分类时，转换为可执行的中文引导；不让原始英文码覆盖恢复说明，保留草稿和续费入口。

## 0.19.3

### Patch Changes

- 选择器新增每次确认选项的 select 事件，重复选择当前软件也能恢复业务或进入解锁入口，保留 v-model 仅在值变化时更新的兼容语义。
- Updated dependencies
  - @cxx/ui@1.18.0

## 0.19.2

### Patch Changes

- 宿主重新激活当前软件时先退出账户覆盖页，资格刷新期间保持业务遮罩和草稿，避免临时未核验状态错误地打开商城。

## 0.19.1

### Patch Changes

- 当前软件失去订阅资格时保留软件选择器名称，锁定只影响业务区域，避免首次打开或退出账户后显示空白的软件入口。

## 0.19.0

### Minor Changes

- 增加可选个人工作区端口，Vue 与 DOM 外壳统一右侧登录、退出、商城、官网和偏好导航。按请求隔离取消与关闭，合并尺寸和主题更新，登录及退出完成后刷新身份；锁定软件与续费复用同一商城槽。旧账户客户端保持兼容。

## 0.18.0

### Minor Changes

- 4e8ffa2: 选择器支持可选的右侧状态图标与说明。外壳使用宿主快照展示软件锁状态，子模块可映射到同一软件资格；锁定选择进入已有商城入口，账户失效先清空快照，保留业务节点和草稿并拒绝迟到结果。

### Patch Changes

- Updated dependencies [4e8ffa2]
  - @cxx/ui@1.17.0

## 0.17.7

### Patch Changes

- 35f5451: 个人中心仅由账户入口打开，不再列入左上应用切换器；个人页仍可选择真实软件返回业务页面和侧栏，首次软件入口呈现不依赖账户读取。

## 0.17.6

### Patch Changes

- 8b0a423: 个人中心只隐藏业务导航内容，保留侧栏中间布局占位，使账户头像和名称始终位于左下角；返回业务后保持原节点和草稿。

## 0.17.5

### Patch Changes

- 410fea2: 个人中心隐藏业务侧栏，外部应用入口退出个人页；显式选择当前应用也恢复业务视图并保留草稿和节点。保留对等窗口身份恢复后清除旧登录忙碌引导的修复。

## 0.17.4

### Patch Changes

- 629414d: 对等窗口登录成功并恢复已验证的共享身份后，个人中心清除过时的 ACCOUNT_BUSY 引导；迟到的互斥拒绝不覆盖已恢复身份，随后退出也不再显示旧提示。其他操作错误、取消登录和未保存草稿保持原有行为。

## 0.17.3

### Patch Changes

- 随中央控件生命周期补丁更新归档的内部 UI 依赖，保留已集成版本的不可变归档。
- Updated dependencies [2cf6e8d]
  - @cxx/ui@1.16.2

## 0.17.2

### Patch Changes

- 4bb39c2: 普通安装归档同步公共 UI 的编辑器键盘焦点修复依赖，保留本轮统一账户与 Tabs 行为，并使用独立版本保留此前候选归档。
- Updated dependencies [ae2b273]
  - @cxx/ui@1.16.1

## 0.17.1

### Patch Changes

- 65e7694: 恢复底部账户菜单的一致外观，匿名显示未登录，登录后显示经验证的展示名，圆形头像始终不含首字母。壳与个人中心沿用公共字体和宿主主题。分离读取与操作的忙碌状态，仅当前动作显示等待，支持取消登录；后台读取失败保留已展示资料。身份和软件权限仍由宿主核验。
- d850a2a: 外壳与嵌入的个人中心共用账户快照和变更订阅。宿主省略可选 onChanged 时，登录、退出及手动刷新仍同步身份与业务可用状态，保留草稿、取消和迟到结果保护。
- Updated dependencies [882074e]
- Updated dependencies [7e51560]
- Updated dependencies [65e7694]
  - @cxx/icons@0.6.3
  - @cxx/ui@1.16.0

## 0.17.0

### Minor Changes

- 5e73ab0: 未登录外壳显示登录和注册入口并隐藏头像，默认保留第一个软件；注册由宿主提供受信导航，统一保留草稿和权限引导。

### Patch Changes

- Updated dependencies [6cb0618]
  - @cxx/ui@1.15.2

## 0.16.1

### Patch Changes

- 99c8c26: 提供原生输入与搜索适配，释放隐藏或失活触发器的交互详情；外部应用入口拒绝保留标识，选择宿主链接时保持原页面。项目表单与冲突扩展支持宿主提供标准图标资源地址，避免网站依赖安装应用的相对图标目录。
- Updated dependencies [99c8c26]
  - @cxx/ui@1.14.0

## 0.16.0

### Minor Changes

- 6370cf9: 增加可注入的个人中心与账户菜单，展示软件订阅和可恢复的使用引导；统一 Vue 与 DOM 外壳，保留不可用软件的页面及草稿，复用现有主题与控件。

### Patch Changes

- Updated dependencies [62292f0]
- Updated dependencies [5d15d6a]
  - @cxx/ui@1.13.0

## 0.15.7

### Patch Changes

- 59f6f77: 应用切换菜单按内容与可用视口展开，避免少量入口刚好超过固定高度而产生多余滚动条；选择器提供共用的 maxListHeight 策略，普通选择器默认高度保持兼容。
- Updated dependencies [19e37a2]
- Updated dependencies [87ae328]
- Updated dependencies [59f6f77]
- Updated dependencies [59f6f77]
  - @cxx/icons@0.6.0
  - @cxx/ui@1.10.0

## 0.15.6

### Patch Changes

- efc9644: 类目树、编译环境和打开方式规则的新增入口统一使用标准 03-new-project 图标，保留原有操作与按钮布局。

  静态图标资源随控件编译，避免运行期直接加载 SVG 模块；新增图标不影响 Node 渲染与纯 DOM 入口。

- Updated dependencies [efc9644]
  - @cxx/ui@1.9.1

## 0.15.5

### Patch Changes

- 1aa5c04: 设置导航使用中央图标库中对应用途的图形：外观使用调色板，消息使用通知铃铛，日志设置使用历史记录；应用设置入口保留齿轮。
- Updated dependencies [579144f]
- Updated dependencies [9054bf9]
- Updated dependencies [3439469]
- Updated dependencies [309b760]
  - @cxx/ui@1.9.0

## 0.15.4

### Patch Changes

- f4a4dc7: 参数上下文示例支持受控初始配置，目录树提供真实前置状态与增删改移回写；星图持续凸显导航选中的参数，下拉高亮统一为半透明反馈。补充按用途组织的导航图标及完整四态，支持皮肤色板。

  弹窗、消息、停靠阴影和窗口按钮反馈统一读取皮肤令牌，浅色皮肤使用对应遮罩与阴影。

- Updated dependencies [131069d]
- Updated dependencies [f4a4dc7]
- Updated dependencies [742edbf]
  - @cxx/ui@1.7.1
  - @cxx/icons@0.5.0

## 0.15.3

### Patch Changes

- Updated dependencies [0a6ee6e]
- Updated dependencies [9d87ff3]
- Updated dependencies [c544535]
- Updated dependencies [06028bd]
- Updated dependencies [64731f5]
- Updated dependencies [8d5be6e]
- Updated dependencies [65f63f2]
- Updated dependencies [3b72597]
- Updated dependencies [939a42b]
  - @cxx/ui@1.6.0
  - @cxx/icons@0.4.0

## 0.15.2

### Patch Changes

- 3edc248: 移除效果图额外描边，缩短停顿并采用连续缓入缓出，衔接悬停与点击并等待真实任务完成。增加实例隔离的示意鼠标和真实拖放步骤，工具栏完整演示跨分割线置顶、替换与执行，区分单一效果的步骤与多个独立效果的顺序清单，文件管理演示三种动作回执。暂停、离屏和销毁释放拖影及所属门户。文件动作菜单继承触发区域主题，避免深色下文字变黑。
- Updated dependencies [3edc248]
  - @cxx/ui@1.4.0

## 0.15.1

### Patch Changes

- b7e1033: 组件提供效果图场景，公共预演统一播放、限制真实交互并管理可见性与取消；另提供默认未启用的动画教程指引，步骤与效果由使用方注入。
- Updated dependencies [8ef3151]
- Updated dependencies [b7e1033]
  - @cxx/ui@1.3.0

## 0.15.0

### Minor Changes

- 31528e2: 为原生宿主增加动态应用入口；切换由宿主处理，保持当前页面的草稿、选择和设置状态。入口更新整批校验并具备销毁保护。

## 0.14.0

### Minor Changes

- 9860ed9: 外壳侧栏复用中央分隔线，按视图记忆宽度并支持图标最小宽度；设置导航补齐图标与完整名称提示。
  项目导航通过 drag 组合中央拖曳排序及失败回滚，窄栏自动收为图标。
  选择器和分组菜单提供图标模式，原生分隔线允许两侧独立最小宽度。

  修正中央拖曳内核未启用实际布局方向的问题，竖列和网格按真实位置计算落点。

### Patch Changes

- ac99f96: 统一原生、Vue 和 Shadow DOM 的中央滚动条样式，移除日志及文档的重复定义，提供独立 CSS 入口。
- 81d88c0: 应用日志使用独立滚动记录区和紧凑筛选栏，刷新保留详情与滚动位置。
  等价资源范围不重复查询，搜索合并输入；移除额外的项目清除行，单应用隐藏冗余选择器。
- Updated dependencies [ac99f96]
- Updated dependencies [9860ed9]
  - @cxx/ui@1.2.0

## 0.13.2

### Patch Changes

- 281bbc7: 应用模态弹窗保留窗口控制栏操作，同时阻止焦点进入遮罩下的业务控件；统一处理嵌套层、Shadow DOM、门户和关闭回焦。窗口几何约束改用唯一策略，极窄区域的边距服从可用空间。
- Updated dependencies [281bbc7]
  - @cxx/ui@1.1.1

## 0.13.1

### Patch Changes

- 6e98300: 普通弹窗的遮罩、拖动、边角缩放和最大化统一约束到所属应用内容区，保留窗口控制栏可用；Vue 与原生 DOM 共用交互及焦点边界，支持位置尺寸记忆。
- Updated dependencies [6e98300]
- Updated dependencies [5fa5d36]
- Updated dependencies [02fdbf5]
  - @cxx/ui@1.1.0

## 0.13.0

### Minor Changes

- e0f01a1: 统一类型在前的组件命名，旧名称集中兼容；标签、消息和加载按能力分类。文件编辑器承担普通文本模式，新增卡片/便签 drag 组合能力和原生 Card，产品卡片皮肤抽回中央。

  createTextEditor 从通用 dom 入口移至 editor 兼容入口，返回公共 FileEditor，直接访问 textarea.value/readOnly 的调用需改用实例方法。

  预演卡片按组合关系注册，自动进入预演的常用组合画廊；组合 Demo 使用自身合同，不重复递归生成组件文档。

- fc0c0a7: 按所属类型统一类目、弹窗、主题、外壳、日志及配套执行器的实际公开名称，保留旧名称兼容别名。中央注册校验类型前缀，文档与产品调用使用同一份注册身份。
- afd7ad1: 注册模块按导航能力分层；文件编辑器配套能力声明所属关系，文档、旧链接、大纲和总览统一消费。补充文件管理按钮注册、可运行示例和不加载外壳的窄入口，支持宿主解析构建后的图标 URL。拖曳排序与独立窗口标题栏归所属能力说明。

### Patch Changes

- 875f30b: 普通菜单支持按触发区域匹配宽度，保留视口限制。账户菜单启用等宽布局，在宽侧栏和窄窗口中与账户栏对齐。
- Updated dependencies [875f30b]
- Updated dependencies [e0f01a1]
- Updated dependencies [fc0c0a7]
- Updated dependencies [afd7ad1]
  - @cxx/ui@1.0.0

## 0.12.1

### Patch Changes

- Updated dependencies [bf3fb51]
  - @cxx/ui@0.27.0

## 0.12.0

### Minor Changes

- 6eba83e: 全部中央组件由所属包注册文档、参数、皮肤与示例，增加应用框架和项目能力的公开 registry 窄入口。统一分类、实际导出名、标准预演和参数上下文预演，分开 Vue 属性、原生选项与宿主接口。提示样式与文件编辑器共用同一基础样式，普通关闭动作复用中央按钮。

### Patch Changes

- Updated dependencies [e1d1b01]
- Updated dependencies [645bbb2]
- Updated dependencies [645bbb2]
- Updated dependencies [a92c024]
- Updated dependencies [6eba83e]
- Updated dependencies [9361614]
- Updated dependencies [6eba83e]
- Updated dependencies [cf5ab74]
- Updated dependencies [6ed8c0c]
  - @cxx/ui@0.26.0

## 0.11.4

### Patch Changes

- 归档中的公共 UI 依赖范围同步到完整源码编辑版本，使用新包版本保持已有归档内容不变。

## 0.11.3

### Patch Changes

- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies [3ed4b5a]
  - @cxx/ui@0.25.0

## 0.11.2

### Patch Changes

- Updated dependencies [b651f0b]
- Updated dependencies [b651f0b]
- Updated dependencies [b651f0b]
- Updated dependencies [3f4e6de]
- Updated dependencies [b651f0b]
- Updated dependencies [dc8f6e9]
- Updated dependencies [d9dd2d7]
- Updated dependencies [49e7af8]
- Updated dependencies [b651f0b]
- Updated dependencies [b71d872]
- Updated dependencies [b651f0b]
- Updated dependencies [b651f0b]
- Updated dependencies [5dcf1cb]
- Updated dependencies [b651f0b]
- Updated dependencies [ac2f4f4]
- Updated dependencies [b651f0b]
  - @cxx/ui@0.24.0

## 0.11.1

### Patch Changes

- 9161ea9: 统一接管按钮与内容的悬停说明，复用 Tooltip 顶层显示、主题和释放能力；外壳自动接入，避免原生气泡重复、层级遮挡与容器裁切，支持动态文案、Shadow DOM 和键盘焦点。
- Updated dependencies [59fc82e]
- Updated dependencies [9161ea9]
  - @cxx/ui@0.23.0

## 0.11.0

### Minor Changes

- 1d5ef2e: 统一 Vue 与 DOM 消息的上方居中、暂停和退出策略，按真实日志写入回执收取提示；新增公共消息设置与可默认关闭的日志类别。保留数字时长和显式常驻用法。

### Patch Changes

- Updated dependencies [1d5ef2e]
- Updated dependencies [b3e1eb0]
- Updated dependencies [2147fe8]
- Updated dependencies [25adbbc]
- Updated dependencies [83a4ad7]
- Updated dependencies [0b50199]
  - @cxx/ui@0.22.0

## 0.10.2

### Patch Changes

- 65f6737: 新增可嵌入应用公共设置的文件编辑器配置组件，复用配色、编辑插件及编译环境表单；保存失败保留草稿，卸载后拒绝迟到结果。编辑光标使用主题色并加粗、闪烁，应用切换器的设置入口更名为应用设置。
- Updated dependencies [65f6737]
  - @cxx/ui@0.21.0

## 0.10.1

### Patch Changes

- Updated dependencies [066a8b9]
- Updated dependencies [066a8b9]
- Updated dependencies [066a8b9]
- Updated dependencies [6b201de]
- Updated dependencies [3788364]
- Updated dependencies [a98dae8]
- Updated dependencies [f3bd8f9]
- Updated dependencies [961eaef]
- Updated dependencies [066a8b9]
  - @cxx/ui@0.20.0

## 0.10.0

### Minor Changes

- 设置面板的提交键改用统一的 `CxxButton preset="confirm"`（`CxxConfirmButton` 已下线），文件管理按钮的工厂由 `createIconButton` 改为 `createButton`。

## 0.9.0

### Minor Changes

- d24aa07: 增加视图交互作用域，统一清理切页时遗留的菜单、提示、工具栏和弹窗，拒绝失活页面的迟到面板。外壳支持视图变化通知与同页交互重置。

  工具栏同步浮层与置顶栏的忙碌状态，放下时立即释放拖动状态，快速跨行拖动更新落点。关闭的便签工具栏不再监听全局动画或布局变化，展开时才观察定位。

### Patch Changes

- Updated dependencies [d24aa07]
  - @cxx/ui@0.16.0

## 0.8.11

### Patch Changes

- 日志设置的**「日志地址」直接把地址显示在输入框里**：地址没填过时填的就是默认目录本身（宿主 `defaultPath()`），不再空着只给一句「留空使用默认位置」，也不再在下面单列一行讲默认位置。
- 落盘口径：值恰好等于默认目录时写空串 —— 界面上看到的是具体地址，配置里留着的仍是「跟随默认目录」，默认目录换了（安装位置变动、便携化）能自动跟上。占位文案改为「选择或填写日志目录」。

## 0.8.10

### Patch Changes

- 随 `@cxx/ui` 0.15.2 重打（下拉定宽与弹层宽度）。设置页里的下拉（外观主题、日志应用等）在块级容器里照旧铺满，观感不变。
  - @cxx/ui@0.15.2

## 0.8.9

### Patch Changes

- **「默认位置」不再只是一句话，而是把默认目录按实际路径显示出来**（`留空就用默认位置：<code>C:\…</code>`）：`LogClient` 增加第四条可选能力 **`defaultPath()`**（默认目录，即留空时日志落在哪）。宿主不给这个能力时这一行不渲染，其余不变。
- 默认目录按实际路径排版：等宽字、比说明句亮一档，长路径就地折行不撑破表单。
  - @cxx/ui@0.15.1

## 0.8.8

### Patch Changes

- 随 `@cxx/ui` 0.15.1 重打（路径选择器禁用态拦悬停的写法改了）。设置页的行为与观感不变。
  - @cxx/ui@0.15.1

## 0.8.7

### Patch Changes

- **「日志地址」从文本框换成路径行**（`CxxInputPath`）：可以点文件夹图标去挑目录，也能直接输入 / 粘贴；尾部那一截（目录 + 名字）不传 —— 地址是一整个目录，没有后半段可言。
- `LogClient` 增加第三条可选能力 **`pickPath()`**：用系统选择器挑一个目录，取消返回空串。与 `getPath` / `savePath` 同一个口径 —— 三样齐了才渲染这一格（宿主不能浏览，就不该给一个"看起来能选、点了没反应"的路径行）。
  - @cxx/ui@0.15.0

## 0.8.6

### Patch Changes

- 设置页各面板的保存键随 `@cxx/ui` 0.14.1 收进**右下角**：「日志设置」与「文件夹与打开方式」的表单末尾从此与「新建项目 / 新增派生」的确认键同一位置。
  - @cxx/ui@0.14.1

## 0.8.5

### Patch Changes

- **设置页各面板的保存改用中央的确认图标键**（`CxxConfirmButton`，`icons/97-confirm.svg`）：「日志设置」与「文件夹与打开方式」那两颗全宽文字键，换成与「新建项目」表单同一颗绿对勾。动作用语仍留在 `aria-label` / `title` 上（读屏与悬停都读得到），保存反馈仍是面板里的 `role="status"` 文案。
  - @cxx/ui@0.14.0

## 0.8.4

### Patch Changes

- **设置页左侧导航改用中央的分组菜单组件**（`CxxCategoryMenuGroup`，`sm` 档）：分组头成了可折叠的标题（带三角箭头与底边），条目行与它的悬停/选中反馈都由组件给，不再由设置页自己画一套。分组仍按条目自带的 `group` 划分，顺序按首次出现排。
  `settings.css` 里那份 `.cxx-settings-nav button` / `h3` 的旧行样式随之删除，只留容器（内边距、滚动、右分隔线、底色）—— 否则会盖在组件的行样式上。
  - @cxx/ui@0.13.3

## 0.8.3

### Patch Changes

- **「文件夹 / 普通文件」补上字段名** —— 中央 `Select` 只把 label 当 `aria-label`，不渲染可见字段名，两行下拉因此只剩选中值（一个「配置工具」一个「系统默认程序」），读不出哪行管什么。行标签改由本页自己给。
  同时把「后缀覆盖」这一组多行的行标签改为顶部对齐 —— 居中会让标签掉到两行中间。
  - @cxx/ui@0.13.2

## 0.8.2

### Minor Changes

- **新增「文件管理」能力** —— 中央提供宿主契约、设置页与组合按钮，业务只实现本机动作。
  - `FileManageClient`：读/存打开设置、用系统选择器挑应用、在文件管理器中打开、用配置工具打开、按规则打开、复制路径。
  - `FileManageSettings.vue`：设置页的「文件夹与打开方式」（配置工具 + 文件夹/普通文件的默认打开方式 + 后缀覆盖），由 `mountDomShell` 的 `fileManagement` 传入宿主实现后出现。
  - `configureOpening(client, group)`：缺工具配置时的引导框，与设置页共用同一份表单 —— 保存后继续原来的打开动作。
  - `createFileManagerButton({ path, actions })`：**组合按钮**，一颗图标键点开是三个文件动作，避免卡片为三件事各挂一颗键。
  - `resolveDefaultOpener` 一类的规则解释仍属宿主：中央持有**数据形状与编辑界面**，宿主负责按规则调用本机打开。
  - @cxx/ui@0.13.2

## 0.7.0

### Minor Changes

- **日志设置新增「日志地址」** —— 可配置日志文件写到哪个目录。`LogClient` 增加一对**可选**能力 `getPath()` / `savePath()`（宿主实现；不实现时界面不渲染该字段，内存/浏览器宿主不受影响），`LogSettings.vue` 据此加输入框。保存顺序是**先换地址、再写保留时长与记录类型** —— 后两者是写进那个日志文件的，顺序反了会把设置写进旧文件、再由换地址丢掉。
  地址属于**存储位置**、不是日志设置的一部分（写进日志快照会自相矛盾：要读快照才知快照在哪），因此由宿主单独持有。
  - @cxx/ui@0.13.2

## 0.6.3

### Patch Changes

- 重新打包以对齐 `@cxx/ui` 0.13.0：0.6.2 的归档声明的是 `@cxx/ui ^0.11.0`，与产品当前使用的 0.13.0 不兼容。本次不改源码，只抬版本号并重新出包。
  - @cxx/ui@0.13.0

## 0.6.2

### Patch Changes

- e608fad: 清晨浅色将白系图标映射为深墨四态，刷新进度使用该皮肤的前景色。原生应用壳自动持有局部图标换肤与主题同步，销毁后恢复安装前的外观。
- ae06ede: 增加皮肤图标解析、专属资源覆盖和精确颜色/颜色族换色入口；经典深色保留标准库，其他四款皮肤使用中央构建色板。公共图标状态控制器跟随局部皮肤，保留品牌图标与显式标准回退。
- Updated dependencies [5214900]
- Updated dependencies [e608fad]
- Updated dependencies [ae06ede]
  - @cxx/icons@0.3.0
  - @cxx/ui@0.11.0

## 0.6.1

### Patch Changes

- 外观下拉的皮肤清单与 @cxx/ui 对齐：加入「通透玻璃」「中性灰」「暗夜鎏金」，移除「午夜蓝」。
- 账户菜单触发器改用共享的浮层悬停样式（`.cxx-hover-float`）：账户条压在外壳底部，悬停时铺不透明实底会盖住
  下面一层，现在只铺半透明的底且不带白光晕，与滚动箭头同一份观感。
- 0.6.0 已被产品消费过，本次并入的改动让源码与已发布内容不再相同 —— 同号不得再换内容，故另起 0.6.1。

## 0.6.0

### Minor Changes

- **账户菜单只剩「帮助」**：设置不再开弹窗，一律走左上角切换器的「设置」整页视图（左侧设置导航 +
  右侧内容，铺满应用主区），切回任意应用即退出。同一份设置内容不再保留「弹窗」这第二条渲染路径 ——
  两条路径共用同一个 `settingsItems` 与同一套内容插槽，弹窗侧等于是第二份实现，删掉后行为只有一处可改。
- **公开 API 改名**：`showSettings(id?)` / `closeSettings()` → `showSettingsPage(id?)` / `closeSettingsPage()`
  （`mountDomShell` 返回值与 `ShellChrome` 的 `defineExpose` 同步）。参数语义不变：传 id 直接打开对应设置页。
- 业务打开注册设置页（`runtime.openFeature`）、日志页的「去设置」与左上角下拉统一切到整页视图；
  日志页「去设置」不再保留日志视图（与下拉切「设置」一致，先离开上一个视图）。
- `CxxShellSettings` 保留为通用弹窗容器（帮助等场景在用），不再是设置的主入口。

## 0.5.15

### Patch Changes

- 0.5.14 在两条线上各出过一份不同内容（一份是外观下拉的皮肤清单对齐、一份是账户触发器的浮层悬停样式），源码合到一起后取新号 —— 0.5.14 已被产品消费过两份互不相同的内容，同号不得再换。

## 0.5.14

### Patch Changes

- 外观下拉的皮肤清单与 @cxx/ui 0.10.4 对齐：加入「通透玻璃」「中性灰」「暗夜鎏金」，移除「午夜蓝」。
- 账户菜单触发器改用共享的浮层悬停样式（`.cxx-hover-float`）：账户条压在外壳底部、悬停时铺不透明实底会盖住下面一层，现在只铺半透明的底且不带白光晕，与滚动箭头同一份观感。

## 0.5.13

### Patch Changes

- 修：整页设置态下从左上角下拉切到「应用日志」时，没有退出设置 —— 结果是主区显示日志、
  左侧却仍然停在设置导航上。现在下拉选任何一项都会先离开整页设置。

## 0.5.12

### Patch Changes

- 新增整页设置：`CxxSettingsNav`（左栏导航）+ `CxxSettingsContent`（右侧内容），
  与弹窗版 `SettingsCenter` 共用 `cxx-settings-nav` / `cxx-settings-content` 等类，观感一致；
  但不使用 `<dialog>` —— 左侧的「项目看板」整块换成设置导航、主区换成设置内容，
  没有 `::backdrop`、不会 inert 主界面，窗口标题栏的最小化 / 关闭始终可点。
  弹窗版 `SettingsCenter` 保持原样，两版并存。
- `ShellChrome` 左上角应用下拉新增「设置」一项，选中即整页切到设置视图（与「应用日志」同款做法）；
  下拉切回应用即退出设置，不另设退出按钮。

## 0.5.11

### Patch Changes

- 抽取共享下拉模型与文件类型解析窄入口，保留标准图标、文件资源和样式图标独立边界。便利贴动作和排序支持保存失败回滚。新增所有权架构守卫、失败回归和真实按需入口验证。
- Updated dependencies
  - @cxx/icons@0.2.0
  - @cxx/ui@0.8.0

## 0.5.10

### Patch Changes

- 未钉住的图钉悬停或聚焦时缓慢预览插入，移开复原；预览不保存状态。点击确认从当前姿态接续动画，公开预览时长变量，并同步宿主样式构建。
- Updated dependencies
  - @cxx/ui@0.7.2

## 0.5.9

### Patch Changes

- 同步包含图钉按悬停显现规则的公共 UI 构建，保持版本归档不可变。

## 0.5.8

- 同步 UI 0.7.0 动画图钉与统一样式。

## 0.5.7

- 更多操作浮层跟随纸面展开重新定位，靠近右边界时优先翻到左侧，避免遮住拖入目标；观察器随组件销毁释放。

## 0.5.6

- 同步 UI 0.6.2，支持便利贴内部展开动作与通用插槽外观。

## 0.5.5

- 更新中央 UI 依赖到 0.6.1，使组合应用与便利贴共用同一份主题和组件能力。

## 0.5.3

- 增加 dom、titlebar、runtime 窄入口；独立窗口栏不载入完整外壳，Shadow 样式从专用公共入口消费。
- 更新中央 UI 依赖，保持日志 CJS 入口与既有应用装配兼容。

## 0.4.3

### Patch Changes

- 左上应用下拉最小高度调整为 40px，与抽屉和侧栏的原有圆角风格保持一致。

## 0.4.2

### Patch Changes

- Updated dependencies
  - @cxx/ui@0.4.0

## 0.4.1

### Patch Changes

- 抽屉默认铺满右侧应用区域；手动调宽、铺满和标签恢复限制在应用边界，支持窗口变化与自定义承载区域。
- Updated dependencies
  - @cxx/ui@0.3.1

## 0.4.0

### Minor Changes

- 账户菜单统一为设置和帮助；新增整页覆盖的设置中心，公共外观与日志、应用设置通过左侧导航进入，支持 Vue 组件和原生 DOM 表单接入。

## 0.3.0

### Minor Changes

- 所有应用默认提供应用日志和账户日志设置；新增独立日志模型、存储适配协议、分类开关、保留时长及成功/失败操作记录接口，支持 Vue、原生 DOM 和主进程 CJS。

## 0.2.1

### Patch Changes

- Updated dependencies [7cd85ca]
- Updated dependencies
  - @cxx/ui@0.3.0

## 0.2.0

### Minor Changes

- 增加统一主题配置、浅色与午夜蓝皮肤，以及复选/单选/开关、图标按钮、标签页、折叠区、树、空态、页内提示、进度、提示、确认、表格和分页组件。补齐全部组件的交互文档与源码示例。

  应用可通过 accountFeatures 注册配置、模板等功能页面，在同一个账户菜单中排在公共账户选项上方。功能状态归所属应用会话，主题变量同步传入 Shadow DOM 业务区域。

  增加原生 DOM 外壳和项目导航接入、独立窗口标题栏适配及公共停靠/分隔线控制器，供 RepoDock 直接消费版本包。

### Patch Changes

- Updated dependencies
  - @cxx/ui@0.2.0
