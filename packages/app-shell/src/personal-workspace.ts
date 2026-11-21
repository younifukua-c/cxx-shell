import type { ThemeName } from '@cxx/ui';

/** 宿主可在个人工作区承载的受信页面；不接受任意地址。 */
export type PersonalWorkspacePage = 'login' | 'logout' | 'store' | 'website' | 'preferences';

/** 相对于客户端视口的 CSS 像素矩形；宿主负责换算原生坐标。 */
export interface PersonalWorkspaceBounds {
  /** 左边距。 */
  x: number;
  /** 上边距。 */
  y: number;
  /** 可见宽度；零表示暂时隐藏。 */
  width: number;
  /** 可见高度；零表示暂时隐藏。 */
  height: number;
}

/** 显式个人页面导航；省略目标时显示订阅摘要。 */
export interface PersonalWorkspaceTarget {
  /** 宿主负责选择受信路由。 */
  page: PersonalWorkspacePage;
  /** 商城对应的软件标识，不包含价格或授权凭证。 */
  applicationId?: string;
}

/** 一次原生槽请求；只能由创建它的 UI 实例释放。 */
export interface PersonalWorkspaceRequest extends PersonalWorkspaceTarget {
  /** 请求唯一标识，切页与重试必须使用新值。 */
  id: string;
  /** 实际右侧内容区，不能覆盖侧栏或窗口按钮。 */
  bounds: PersonalWorkspaceBounds;
  /** 从当前公共外壳继承的皮肤，不另设选择器。 */
  theme: ThemeName;
}

/** 宿主实现受信页面承载，UI 不访问认证协议或运行平台。 */
export interface PersonalWorkspaceClient {
  /** 登录或标准退出完成才 resolve；其他页加载完成 resolve。失败 reject；取消及迟到结果必须按 id 隔离。 */
  open(request: PersonalWorkspaceRequest, signal: AbortSignal): Promise<void>;
  /** 只更新指定槽的 CSS 矩形和皮肤；不得隐式重新打开页面。 */
  resize(id: string, bounds: PersonalWorkspaceBounds, theme: ThemeName): Promise<void>;
  /** 幂等关闭指定槽；旧 id 不能关闭新槽。宿主须同步终止关联导航。 */
  close(id: string): Promise<void>;
}
