/** 投影宿主节点并返回恢复函数，保留原父节点、顺序和插槽。 */
export function mountDomSlots(
  host: HTMLElement,
  slots: readonly (readonly [HTMLElement | undefined, string])[],
): () => void {
  const originals = slots.flatMap(([node]) => node ? [{
    node,
    parent: node.parentNode,
    next: node.nextSibling,
    slot: node.getAttribute('slot'),
  }] : []);
  if (new Set(originals.map(({ node }) => node)).size !== originals.length)
    throw new Error('各区域必须使用独立的 DOM 节点');
  for (const [node, slot] of slots) {
    if (!node) continue;
    node.slot = slot;
    host.append(node);
  }
  return () => {
    for (const { node, parent, next, slot } of originals.reverse()) {
      if (slot === null) node.removeAttribute('slot');
      else node.setAttribute('slot', slot);
      parent?.insertBefore(node, next?.parentNode === parent ? next : null);
    }
  };
}
