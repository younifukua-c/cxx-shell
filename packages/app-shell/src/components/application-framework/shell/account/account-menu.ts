import type { MenuItem } from '@cxx/ui';
import type { PersonalAccountClient, PersonalWorkspaceTarget } from '../../../../account';

/** 共享账户导航；旧宿主仍展示其已实现的入口，不凭空引入业务地址。 */
export function personalAccountMenu(
  client: PersonalAccountClient | undefined,
  authenticated: boolean,
  icon: string,
  helpIcon: string,
): MenuItem[] {
  const items: MenuItem[] = [];
  if (client?.workspace)
    items.push(
      { id: 'cxx:account', label: authenticated ? '个人中心' : '登录 / 注册', icon },
      { id: 'cxx:store', label: '软件商城', icon },
      { id: 'cxx:website', label: '官网', icon },
    );
  else if (client)
    items.push(
      { id: 'cxx:account', label: '个人中心 · 我的订阅', icon },
      { id: 'cxx:store', label: '逛逛软件', icon },
    );
  items.push({ id: 'cxx:help', label: '帮助', icon: helpIcon });
  return items;
}

/** 菜单只映射受信页面类型，不持有网址、认证凭据或权限事实。 */
export function personalAccountDestination(
  id: string,
  client: PersonalAccountClient | undefined,
  authenticated: boolean,
): { target?: PersonalWorkspaceTarget } | undefined {
  if (!client) return;
  switch (id) {
    case 'cxx:account':
      return { target: client.workspace && !authenticated ? { page: 'login' } : undefined };
    case 'cxx:store':
      return { target: { page: 'store' } };
    case 'cxx:website':
      return { target: { page: 'website' } };
    default:
      return;
  }
}
