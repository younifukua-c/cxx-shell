<script setup lang="ts">
import { provide } from 'vue';
import { runtimeKey, type ApplicationModule, type RuntimeController } from '../../../../../runtime';
import ShadowRegion from './ShadowRegion.vue';
const props = defineProps<{
  app: ApplicationModule;
  runtime: RuntimeController;
  sidebar: HTMLElement;
  main: HTMLElement;
}>();
provide(runtimeKey, props.runtime);
</script>
<template>
  <Teleport :to="sidebar">
    <ShadowRegion
      :styles="app.styles"
      region="sidebar"
      :scroll="runtime.scroll.sidebar"
      @scroll="runtime.scroll.sidebar = $event"
    >
      <component :is="app.sidebar" v-if="app.sidebar" />
    </ShadowRegion>
  </Teleport>
  <Teleport :to="main">
    <ShadowRegion
      :styles="app.styles"
      region="main"
      :scroll="runtime.scroll.main"
      @scroll="runtime.scroll.main = $event"
    >
      <component :is="app.page" />
    </ShadowRegion>
  </Teleport>
</template>
