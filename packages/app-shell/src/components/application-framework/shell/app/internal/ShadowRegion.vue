<script setup lang="ts">
import { ref, shallowRef, onMounted, nextTick } from 'vue';
import { uiStyles } from '@cxx/ui/styles';
const props = defineProps<{ styles?: string; scroll?: number; region: string }>();
const emit = defineEmits<{ scroll: [position: number] }>();
const host = ref<HTMLElement>();
const target = shallowRef<HTMLElement>();
const scroller = ref<HTMLElement>();
onMounted(async () => {
  const root = host.value!.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent =
    uiStyles +
    '\n:host { display:block; height:100%; min-height:0; min-width:0; } .cxx-region { height:100%; overflow:auto; min-width:0; }\n' +
    (props.styles || '');
  const mount = document.createElement('div');
  mount.style.height = '100%';
  root.append(style, mount);
  target.value = mount;
  await nextTick();
  if (scroller.value) scroller.value.scrollTop = props.scroll || 0;
});
</script>
<template>
  <div ref="host" :data-app-region="region">
    <Teleport v-if="target" :to="target">
      <div
        ref="scroller"
        class="cxx-theme cxx-region"
        @scroll="emit('scroll', ($event.target as HTMLElement).scrollTop)"
      >
        <slot />
      </div>
    </Teleport>
  </div>
</template>
