/**
 * Modal / Drawer 经 React Portal 挂到 body 后，点击仍会沿组件树冒泡到触发节点。
 * 表格单元格内打开弹层时，会误触底层行选中/行点击。
 *
 * 用法：传给 Modal 的 maskProps / wrapProps（或等价容器）。
 */
import type { SyntheticEvent } from 'react';

function stopPortalBubble(e: SyntheticEvent) {
  e.stopPropagation();
}

export const MODAL_ISOLATE_POINTER_PROPS = {
  onMouseDown: stopPortalBubble,
  onClick: stopPortalBubble,
  onDoubleClick: stopPortalBubble,
} as const;
