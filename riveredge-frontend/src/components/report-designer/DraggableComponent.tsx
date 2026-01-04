/**
 * 可拖拽组件包装器
 *
 * 用于包装报表组件，使其支持拖拽
 *
 * @author Luigi Lu
 * @date 2025-01-15
 */

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ReportComponent } from './index';

/**
 * 可拖拽组件Props
 */
export interface DraggableComponentProps {
  component: ReportComponent;
  isSelected?: boolean;
  onClick?: () => void;
  onRender: (component: ReportComponent) => React.ReactNode;
}

/**
 * 可拖拽组件
 */
const DraggableComponent: React.FC<DraggableComponentProps> = ({
  component,
  isSelected = false,
  onClick,
  onRender,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: component.id });

  const style = {
    position: 'absolute' as const,
    left: component.x,
    top: component.y,
    width: component.width,
    height: component.height,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    border: isSelected ? '2px solid #1890ff' : '1px dashed #ccc',
    cursor: 'move',
    zIndex: isSelected ? 10 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
    >
      {onRender(component)}
    </div>
  );
};

export default DraggableComponent;

