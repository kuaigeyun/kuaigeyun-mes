/**
 * 快速新增：Popover 对齐到 UniDropdown 外层锚点（字段下方/旁侧），避免居中 Modal。
 */

import React from 'react';
import { Popover, theme } from 'antd';

export interface QuickCreateAnchorPopoverProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  /** 浮于业务 Modal 之上时传入（如 FormModalTemplate 的 zIndex + 偏移） */
  zIndex?: number;
  placement?: 'bottomLeft' | 'bottom' | 'topLeft' | 'top';
}

/**
 * 用 fixed 占位元素对齐到 anchorEl.getBoundingClientRect()，使 Popover 挂在字段附近。
 */
export const QuickCreateAnchorPopover: React.FC<QuickCreateAnchorPopoverProps> = ({
  open,
  anchorEl,
  title,
  onClose,
  children,
  zIndex,
  placement = 'bottomLeft',
}) => {
  const { token } = theme.useToken();
  if (!open || !anchorEl) return null;
  const rect = anchorEl.getBoundingClientRect();
  const popupZ = zIndex ?? token.zIndexPopupBase + 50;

  return (
    <Popover
      open
      title={title}
      placement={placement}
      trigger={['click']}
      zIndex={popupZ}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      content={
        <div onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      }
      destroyOnHidden
      getPopupContainer={() => document.body}
    >
      <span
        style={{
          position: 'fixed',
          left: rect.left,
          top: rect.top,
          width: Math.max(rect.width, 120),
          height: Math.max(rect.height, 28),
          pointerEvents: 'none',
          margin: 0,
          padding: 0,
        }}
        aria-hidden
      />
    </Popover>
  );
};
