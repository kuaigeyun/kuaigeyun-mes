/**
 * Modal / Drawer 经 React Portal 挂到 body 后，点击仍会沿 React 树冒泡到触发节点。
 * 表格单元格内打开弹层时，会误触底层行选中/行点击。
 *
 * 标准用法：
 * - 全局：`patches/isolatedRcDialog.tsx` 经 vite alias 注入（入口无需逐页传）
 * - 单页：传给 Modal 的 maskProps / wrapProps（或等价容器）
 */
import type { HTMLAttributes, SyntheticEvent } from 'react';

function stopPortalBubble(e: SyntheticEvent) {
  e.stopPropagation();
}

export const MODAL_ISOLATE_POINTER_PROPS = {
  onMouseDown: stopPortalBubble,
  onClick: stopPortalBubble,
  onDoubleClick: stopPortalBubble,
} as const;

type PointerHandlers = Pick<
  HTMLAttributes<HTMLDivElement>,
  'onMouseDown' | 'onClick' | 'onDoubleClick'
>;

/**
 * 合并用户 maskProps/wrapProps 与隔离 handler。
 * 先 stopPropagation，再调用用户回调（避免覆盖后丢失业务 onClick）。
 */
export function mergeOverlayIsolateProps<T extends PointerHandlers | undefined>(
  existing?: T,
): T & typeof MODAL_ISOLATE_POINTER_PROPS {
  return {
    ...(existing as T),
    onMouseDown: (e) => {
      stopPortalBubble(e);
      existing?.onMouseDown?.(e);
    },
    onClick: (e) => {
      stopPortalBubble(e);
      existing?.onClick?.(e);
    },
    onDoubleClick: (e) => {
      stopPortalBubble(e);
      existing?.onDoubleClick?.(e);
    },
  } as T & typeof MODAL_ISOLATE_POINTER_PROPS;
}

/** Modal 内 Select 下拉挂到内容区，避免明细表 overflow 裁切与 body 滚动锁竞争 */
export function getPopupContainerInModal(trigger: HTMLElement): HTMLElement {
  const el = trigger.closest('.ant-modal-content') ?? trigger.closest('.ant-modal-wrap');
  return (el as HTMLElement) ?? document.body;
}
