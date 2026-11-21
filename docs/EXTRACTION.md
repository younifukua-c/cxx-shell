# 框架迁移收据

## 原始来源

| 当前所有者 | 原始仓库与提交 | 原路径 |
| --- | --- | --- |
| packages/app-shell | cxx-ui beta @ b04c13d | packages/app-shell |
| packages/host-runtime | cxx-repodock beta @ 75aae48 | packages/host-runtime |
| host-runtime 应用加载器 | cxx-repodock beta @ 75aae48 | src/main/external-applications.js、external-module-loader.js |

公开包名保持不变。UI 不再构建 app-shell，产品不再构建 host-runtime；消费者通过各自锁文件与 vendor 中的不可变归档安装。公共包版本以本仓各自 package.json 为准，归档清单包含 SHA-512；重复打包必须逐字节一致才能复用同版本归档。

app-shell 的 GroupMenuGroup 类型改用 UI 已公开的包根入口，消除旧同仓源码别名掩盖的未导出子路径。宿主应用加载器增加可选的进程能力和宿主能力注入口，保留程序摘要核对、取消、释放失败重试和模块缓存归属。

## 产品入口

RepoDock 提供自己的业务工厂和预加载桥；普通启动转交独立 Shell。隔离自动化测试保留原产品集成合同夹具，正式环境没有此回退。产品的项目、Git、脚本和进程能力没有进入 Shell。

部署流沿用公开应用工厂；从应用中心首次直接打开时定位自己的后台包配置，既有配置不覆盖。Java 环境仍通过运行环境租约取得，关闭后台后释放。

应用中心沿用原 settings/common/application-center/applications.json；分组、安装位置和停用选择不复制到另一份设置。浏览器资料位置由原环境记录决定，不从产品目录推断。

## 已验证的边界

Shell 测试覆盖空目录启动、渲染沙箱、账户资格先于工厂加载、关闭取消与释放、模块重开、三种主题和草稿保持；真实 Windows EXE 可在没有业务源码的环境中启动。

真实子应用测试通过公开清单和工厂打开 RepoDock、保存与查询 Git 项目并重开，打开部署流的真实后台并释放重开。此类测试仅在独立测试根内注入合成账户，不能证明生产账户的真实订阅；正式入口仍使用 SDK 和真实资格核验。

仓库外 tarball 消费同时验证全部宿主公开入口、TypeScript 回调合同和浏览器外壳构建，不使用兄弟源码别名。正式安装器需要已登记的公开认证配置，本次只构建内部 Windows 测试包，没有发布、部署、拉取或合并分支。
