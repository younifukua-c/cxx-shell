# CXX Shell

独立桌面主程序与公共框架包。Shell 拥有原生窗口、账户、应用中心、应用会话和运行环境生命周期；RepoDock 与部署流通过公开应用工厂接入，各自保留业务服务和资料。

## 依赖边界

- 本仓维护 `@cxx/app-shell`（Vue/DOM 应用外壳）和 `@cxx/host-runtime`（Node/Electron 宿主端口）。
- 通用控件和图标由 `@cxx/ui`、`@cxx/icons` 提供；Shell 消费锁定归档，不引用兄弟仓库源码。
- 产品声明 `package.json.cxxApplication`，提供 `createApplication({environment,electron,runtimes,access,signal,host})`，返回 `load(view)` / `dispose()`。登记不执行产品代码，打开前核对资格与程序摘要。
- 框架不包含 Git、SQL 或产品数据查询。只有产品工厂可以加载自身实现。账户失败提供登录/连接/套餐入口，不关闭公共能力。

## 开发和验证

统一使用 package.json 声明的 pnpm。

```sh
pnpm install --frozen-lockfile
pnpm start -- --test-root=.local/manual-test
pnpm typecheck
pnpm test:unit
pnpm test:architecture
pnpm test
pnpm pack:all
pnpm test:consumer
pnpm build -- --test
pnpm test:desktop
```

子应用集成验收可通过 `pnpm test:desktop -- --application-root=<产品根目录>` 指定已安装依赖、构建预加载的真实产品。该入口仅在独立测试环境使用合成账户夹具，不更改正式认证路径。默认桌面测试要求先构建测试 EXE。

`pnpm start` 无测试参数使用当前系统账户的正式环境。手工验收必须显式传独立测试根目录。测试 EXE 位于 `dist/test/win-unpacked`，只能传 `--test-root` 启动。

## 安装与数据

正式 Windows 目录包：设置 `CXX_AUTHORITY_PROFILE_FILE` 为已登记的正式公开认证配置，运行 `pnpm build`；安装器运行 `pnpm build -- --installer`。发布配置由构建元数据持有，不接受运行时任意覆盖。测试性质不授予软件资格。未经配置不生成伪正式包，不自动发布。

同账户定位文件和已有 environment.json 决定资料位置。原应用中心登记、分组、安装位置和停用选择继续使用同一记录；已有浏览器资料位置保持有效。首次接管可按旧宿主已登记的原位置加入升级后的公开产品，不执行工厂，不复制业务资料。卸载不默认删除公共数据或实际项目仓库。

更多公开 API 见两个 packages 的 README。构建产物和运行资料不提交，归档按版本不可覆盖；消费者各自锁定归档及摘要。
