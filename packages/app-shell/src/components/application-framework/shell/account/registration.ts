import { defineCentralComponent } from '@cxx/ui/registry';

const authButton = '.cxx-personal-actions > button:first-child';
const signIn = { title: '模拟宿主登录，身份摘要随结果更新', action: 'activate', target: authButton } as const;
const signOut = { title: '模拟宿主退出，回到未登录状态', action: 'activate', target: authButton } as const;
const refresh = { title: '点击刷新，重新读取宿主提供的订阅摘要', action: 'activate', target: '.cxx-personal-actions > button:nth-child(2)' } as const;
const store = { title: '点击续费入口，查看传给宿主的软件标识', action: 'activate', target: '.cxx-personal-software > :nth-child(2) button' } as const;
const context = { label: '个人中心宿主示例', source: 'PersonalCenter' };

/** 个人中心只展示宿主明确注入的身份、软件及可操作引导。 */
export const personalCenterRegistration = /* @__PURE__ */ defineCentralComponent({
  id: 'PersonalCenter', name: '个人中心', category: '外壳与设置',
  effect: { steps: [signIn, refresh, store, signOut] },
  description: '统一账户、软件与订阅摘要；预期状态提供登录、套餐、续费、刷新和退出重试。',
  source: 'PersonalAccountClient 注入端口', kind: '新增',
  props: [{ name: 'client', type: 'PersonalAccountClient', default: '必填', description: 'read/signIn/signOut/openStore，以及可选 onChanged/workspace；不接收凭据、不直接执行 HTTP。' },
    { name: 'navigate', type: '(target: PersonalWorkspaceTarget) => void', default: '旧端口动作', description: '外壳注入统一导航，使登录、退出、软件卡续费进入同一右侧工作区；独立使用者负责承载和释放。',
      preview: { examples: [{ ...context, props: { navigateInHost: true } }], effect: { steps: [
        { ...signIn, title: '点击登录，展示外壳收到的导航目标' }, store,
      ] } } }],
  events: ['identity(name)'], slots: [],
  memberPreviews: { 'event:identity': { examples: [context], effect: { steps: [signIn, signOut] } } },
  tips: ['免费软件不要求存在价格或订单。', '到期只影响对应软件；保留资料和草稿，实际业务操作仍由宿主与服务端校验。', '文档中的演示账户和软件均为内存示例，不执行真实登录或购买。'],
  package: '@cxx/app-shell', usage: [], type: 'vue', entry: '@cxx/app-shell', exportName: 'CxxShellPersonalCenter',
  demo: { mode: 'source', language: 'vue-sfc', source: 'PersonalCenter' },
  apiSections: [{ title: '宿主端口', entry: '@cxx/app-shell', rows: [
    { name: 'read(signal)', type: 'Promise<AccountSnapshot>', default: '宿主实现', description: '身份、软件数组、可选 signOutPending/issue；取消及切换账户后的迟到结果不能发布。',
      preview: { examples: [context], effect: { steps: [refresh] } } },
    { name: 'signIn / signOut', type: 'Promise<void>', default: '宿主实现', description: '标准认证和撤销由宿主执行；退出未确认时给出明确重试，不能声称已完成中心退出。',
      preview: { examples: [context], effect: { steps: [signIn, signOut] } } },
    { name: 'openStore(applicationId?)', type: 'Promise<void>', default: '宿主实现', description: '只接受可信软件标识，由商城提供实际价格、升级和续费，不在组件中计算费用。',
      preview: { examples: [context], effect: { steps: [store] } } },
    { name: 'AccountSoftware.startsAt', type: 'string | undefined', default: '不显示', description: '中央返回的订阅开始时间，与套餐名称和 expiresAt 一同展示；没有值不推算。',
      preview: { examples: [context], effect: { steps: [
        { title: '对照两个软件，只有宿主提供开始时间的订阅显示该日期', action: 'observe', target: '.cxx-personal-software' },
      ] } } },
  ] }],
  theme: { styles: ['@cxx/ui/style.css', '@cxx/app-shell/style.css'] },
});
