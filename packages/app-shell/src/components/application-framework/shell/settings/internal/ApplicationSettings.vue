<script setup lang="ts">
import { provide } from 'vue';
import { runtimeKey, type ApplicationFeature, type RuntimeController } from '../../../../../runtime';
import ShadowRegion from '../../app/internal/ShadowRegion.vue';
const props = defineProps<{
  section: ApplicationFeature;
  runtime: RuntimeController;
  styles?: string;
}>();
provide(runtimeKey, props.runtime);
</script>
<template>
  <ShadowRegion :styles="styles" region="settings">
    <component :is="section.component" />
  </ShadowRegion>
</template>
