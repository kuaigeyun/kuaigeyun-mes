/**
 * 画布组件
 *
 * 作为拖拽目标区域
 *
 * @author Luigi Lu
 * @date 2025-01-15
 */

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { CANVAS_GRID_STYLE } from '../layout-templates';

/**
 * 画布Props
 */
export interface CanvasProps {
  id: string;
  children: React.ReactNode;
  components: any[];
}

/**
 * 画布组件
 */
const Canvas: React.FC<CanvasProps> = ({ id, children, components }) => {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        minHeight: '600px',
        ...(isOver ? { background: '#e6f7ff' } : { ...CANVAS_GRID_STYLE, backgroundColor: '#fff' }),
        position: 'relative',
        border: isOver ? '2px dashed #1890ff' : '1px solid #f0f0f0',
        transition: 'all 0.2s',
      }}
    >
      <SortableContext items={components.map((c) => c.id)}>
        {children}
      </SortableContext>
    </div>
  );
};

export default Canvas;

