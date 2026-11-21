<script setup lang="ts">
import { CxxAlert, CxxButton } from '@cxx/ui';
defineProps<{ message: string; hasAccount: boolean; showRenew: boolean }>();
const emit = defineEmits<{ personal: []; renew: []; retry: [] }>();
</script>
<template>
  <CxxAlert tone="info" title="继续使用这款软件">
    <p>{{ message }}</p>
    <CxxButton
      v-if="hasAccount"
      :help="{ purpose: '登录、核对订阅或续费，保留当前软件草稿' }"
      @click="emit('personal')"
    >
      个人中心 / 我的订阅
    </CxxButton>
    <CxxButton
      v-if="showRenew"
      :help="{ purpose: '查看当前软件的购买或续费入口，不提交订单' }"
      @click="emit('renew')"
    >
      查看套餐 / 续费
    </CxxButton>
    <CxxButton :help="{ purpose: '检查连接后重新核对使用资格' }" @click="emit('retry')">
      重试
    </CxxButton>
  </CxxAlert>
</template>
