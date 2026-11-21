import { computed, type Ref } from 'vue';
import type { PersonalAccountClient } from '../../../../account';
import { providePersonalAccountSnapshot } from './personal-account-snapshot';
import { accountAccessIndex, applicationAccess } from '../../../../application-access';

/** 身份和当前软件状态仅供展示；实际业务权限始终由宿主执行。 */
export function usePersonalAccount(
  client: Readonly<Ref<PersonalAccountClient | undefined>>,
  applicationId: Readonly<Ref<string | null>>,
  required: Readonly<Ref<boolean>>,
) {
  const { snapshot, unavailable, verified, refresh, revalidate } =
    providePersonalAccountSnapshot(client);
  const index = computed(() => accountAccessIndex(snapshot.value));
  const access = (id: string | null, requireAccount = false) =>
    applicationAccess(index.value, id, {
      configured: !!client.value,
      required: requireAccount,
      verified: verified.value,
      unavailable: unavailable.value,
      authenticated: !!snapshot.value?.identity,
    });
  const current = computed(() => access(applicationId.value, required.value));
  return {
    authenticated: computed(() => !!snapshot.value?.identity),
    name: computed(() =>
      client.value ? snapshot.value?.identity?.displayName || '未登录' : undefined,
    ),
    blocked: computed(() => !current.value.allowed),
    message: computed(() => current.value.message),
    recovery: computed(() => current.value.recovery),
    access,
    refresh,
    revalidate,
  };
}
