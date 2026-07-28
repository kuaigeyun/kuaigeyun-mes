/**
 * 可拖拽排序表格的序号列（与工艺路线 OperationSequenceEditor 视觉一致）
 */

import React, { createContext, useContext } from 'react';
import { Space } from 'antd';
import { HolderOutlined } from '@ant-design/icons';
import type { GlobalToken } from 'antd/es/theme/interface';
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';

export const SEQUENCE_INDEX_DRAG_HANDLE_CLASS = 'drag-handle';

export type StepDragHandleContextValue = {
  attributes?: DraggableAttributes;
  listeners?: SyntheticListenerMap;
  setActivatorNodeRef?: (element: HTMLElement | null) => void;
  /** 当前行正在被拖拽时，仅手柄展示强调样式 */
  isDragging?: boolean;
};

export const StepDragHandleContext = createContext<StepDragHandleContextValue>({});

export function useStepDragHandleContext() {
  return useContext(StepDragHandleContext);
}

export function getSequenceIndexBadgeStyle(token: GlobalToken): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 28,
    height: 28,
    padding: '0 8px',
    backgroundColor: token.colorPrimaryBg,
    border: `1px solid ${token.colorPrimaryBorder}`,
    borderRadius: 6,
    color: token.colorPrimary,
    fontWeight: 600,
    fontSize: 13,
  };
}

export type SequenceIndexNativeDragHandle = {
  onDragStart: React.DragEventHandler<HTMLSpanElement>;
  onDragEnd: React.DragEventHandler<HTMLSpanElement>;
  isDragging?: boolean;
};

export type SequenceIndexCellProps = {
  index: number;
  token: GlobalToken;
  dragSortTitle?: string;
  showDragHandle?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLSpanElement>;
  /** 工艺路线等：手柄原生 HTML5 拖拽，不经过 dnd-kit，避免 Ant Table 行闪烁 */
  nativeDragHandle?: SequenceIndexNativeDragHandle;
};

export function SequenceIndexCell({
  index,
  token,
  dragSortTitle,
  showDragHandle = true,
  dragHandleProps,
  nativeDragHandle,
}: SequenceIndexCellProps) {
  const dnd = useStepDragHandleContext();
  const useNative = !!nativeDragHandle;
  const mergedDragProps = useNative
    ? {
        ...dragHandleProps,
        draggable: true,
        onDragStart: nativeDragHandle.onDragStart,
        onDragEnd: nativeDragHandle.onDragEnd,
      }
    : {
        ...dragHandleProps,
        ...dnd.attributes,
        ...dnd.listeners,
        ref: (node: HTMLElement | null) => {
          dnd.setActivatorNodeRef?.(node);
          const propRef = (dragHandleProps as { ref?: (node: HTMLElement | null) => void } | undefined)?.ref;
          if (typeof propRef === 'function') propRef(node);
        },
      };
  const handleDragging = useNative ? nativeDragHandle.isDragging : dnd.isDragging;

  return (
    <Space>
      {showDragHandle ? (
        <span
          className={SEQUENCE_INDEX_DRAG_HANDLE_CLASS}
          title={dragSortTitle}
          style={{
            color: token.colorPrimary,
            cursor: 'grab',
            touchAction: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            padding: 4,
            minWidth: 24,
            minHeight: 24,
            borderRadius: 4,
            ...(handleDragging
              ? {
                  cursor: 'grabbing',
                  backgroundColor: token.colorPrimaryBg,
                  boxShadow: token.boxShadowSecondary,
                }
              : null),
          }}
          {...mergedDragProps}
        >
          <HolderOutlined style={{ fontSize: 16 }} />
        </span>
      ) : null}
      <span style={getSequenceIndexBadgeStyle(token)}>{index + 1}</span>
    </Space>
  );
}
