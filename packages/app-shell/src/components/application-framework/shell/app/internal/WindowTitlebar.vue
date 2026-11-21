<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import type { WindowHost } from '../../../../../types';
const props = defineProps<{ windowHost?: WindowHost }>();
const emit = defineEmits<{ error: [error: unknown] }>();
const maximized = ref(false);
let disposed = false;
let unsubscribe: (() => void) | undefined;
function report(error: unknown) {
  emit('error', error);
}
async function control(action: 'minimize' | 'toggleMaximize' | 'close') {
  try {
    const result = await props.windowHost?.[action]();
    if (typeof result === 'boolean') maximized.value = result;
  } catch (error) {
    report(error);
  }
}
onMounted(async () => {
  if (!props.windowHost) return;
  unsubscribe = props.windowHost.onMaximizedChange?.((value) => {
    maximized.value = value;
  });
  try {
    const value = await props.windowHost.isMaximized?.();
    if (!disposed && typeof value === 'boolean') maximized.value = value;
  } catch (error) {
    report(error);
  }
});
onBeforeUnmount(() => {
  disposed = true;
  unsubscribe?.();
});
</script>
<template>
  <header
    class="cxx-window-titlebar"
    aria-label="窗口控制"
    @dblclick="($event.target as HTMLElement).closest('button') || control('toggleMaximize')"
  >
    <div class="cxx-window-controls" data-cxx-window-controls>
      <button
        type="button"
        class="cxx-window-control"
        data-glyph="minimize"
        aria-label="最小化"
        :disabled="!windowHost"
        @click="control('minimize')"
      />
      <button
        type="button"
        class="cxx-window-control"
        data-glyph="maximize"
        :data-state="maximized ? 'restore' : 'maximize'"
        :aria-label="maximized ? '向下还原' : '最大化'"
        :disabled="!windowHost"
        @click="control('toggleMaximize')"
      />
      <button
        type="button"
        class="cxx-window-control cxx-is-close"
        data-glyph="close"
        aria-label="关闭窗口"
        :disabled="!windowHost"
        @click="control('close')"
      />
    </div>
  </header>
</template>
