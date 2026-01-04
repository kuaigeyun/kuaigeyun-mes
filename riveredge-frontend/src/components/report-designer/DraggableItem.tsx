/**
 * 可拖拽的组件库项
 *
 * 用于组件库中的可拖拽按钮
 *
 * @author Luigi Lu
 * @date 2025-01-15
 */

import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Button } from 'antd';

/**
 * 可拖拽项Props
 */
export interface DraggableItemProps {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

/**
 * 可拖拽的组件库项
 */
const DraggableItem: React.FC<DraggableItemProps> = ({ id, label, icon }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <Button block icon={icon}>
        {label}
      </Button>
    </div>
  );
};

export default DraggableItem;

