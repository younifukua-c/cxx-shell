import { onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { attachSplitResize } from '@cxx/ui/interactions';
import type { ShellView } from '../../../../../types';
/** 每个外壳独立记忆各视图的栏宽；只组合中央分隔线，不保存业务数据。 */
export function useSidebarResize(
  layout: Ref<HTMLElement | undefined>,
  sidebar: Ref<HTMLElement | undefined>,
  main: Ref<HTMLElement | undefined>,
  key: Ref<string>,
  minimum: Ref<number>,
) {
  const compact = ref(false);
  const widths = new Map<string, string>();
  const property = '--cxx-shell-sidebar-width';
  let previous = '',
    resize: ReturnType<typeof attachSplitResize> | undefined;
  let observer: ResizeObserver | undefined;
  watch(
    [layout, sidebar, main, key, minimum],
    ([area, before, after, id, min]) => {
      if (!area || !before || !after) return;
      if (previous) widths.set(previous, area.style.getPropertyValue(property));
      resize?.destroy();
      observer?.disconnect();
      previous = id;
      const width = widths.get(id);
      if (width) area.style.setProperty(property, width);
      else area.style.removeProperty(property);
      area.style.setProperty('--cxx-shell-sidebar-min', `${min}px`);
      resize = attachSplitResize(area, before, after, {
        label: '调整应用侧栏宽度',
        property,
        minSize: min,
        afterMinSize: 240,
        mode: 'hairline',
      });
      resize.handle.title = '拖曳调整侧栏宽度；方向键微调，Home 收至图标，双击还原';
      observer = new ResizeObserver(() => {
        compact.value = before.clientWidth < 120;
      });
      observer.observe(before);
    },
    { flush: 'post' },
  );
  onBeforeUnmount(() => {
    resize?.destroy();
    observer?.disconnect();
  });
  return compact;
}

/** 侧栏几何只按页面类型选最小值，不参与导航或权限裁决。 */
export function sidebarMinimumWidth(kind: ShellView['kind'], configured?: number): number {
  const standard = 180,
    settingsCompact = 56,
    applicationCompact = 48;
  if (kind === 'account') return standard;
  if (kind === 'settings') return settingsCompact;
  return Number.isFinite(configured) ? Math.max(applicationCompact, configured!) : standard;
}
