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

export type SequenceIndexCellProps = {
  index: number;
  token: GlobalToken;
  dragSortTitle?: string;
  showDragHandle?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLSpanElement>;
};

export function SequenceIndexCell({
  index,
  token,
  dragSortTitle,
  showDragHandle = true,
  dragHandleProps,
}: SequenceIndexCellProps) {
  const dnd = useStepDragHandleContext();
  const mergedDragProps = {
    ...dragHandleProps,
    ...dnd.attributes,
    ...dnd.listeners,
    ref: (node: HTMLElement | null) => {
      dnd.setActivatorNodeRef?.(node);
      const propRef = (dragHandleProps as { ref?: (node: HTMLElement | null) => void } | undefined)?.ref;
      if (typeof propRef === 'function') propRef(node);
    },
  };

  return (
    <Space>
      {showDragHandle ? (
        <span
          className={SEQUENCE_INDEX_DRAG_HANDLE_CLASS}
          title={dragSortTitle}
          style={{
            color: token.colorPrimary,
            cursor: 'move',
            touchAction: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            padding: 4,
            minWidth: 24,
            minHeight: 24,
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
