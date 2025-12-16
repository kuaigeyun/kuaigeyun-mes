/**
 * 可拖拽的筛选条件项组件
 */

import React from 'react';
import { HolderOutlined } from '@ant-design/icons';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { FilterCondition, ProColumns } from './types';
import { FilterConditionItem } from './FilterCondition';

/**
 * 可拖拽的筛选条件项组件属性
 */
interface SortableFilterConditionProps {
  /**
   * 筛选条件
   */
  condition: FilterCondition;
  /**
   * 表格列定义
   */
  columns: ProColumns<any>[];
  /**
   * 条件变化回调
   */
  onChange: (condition: FilterCondition) => void;
  /**
   * 删除条件回调
   */
  onDelete: () => void;
}

/**
 * 可拖拽的筛选条件项组件
 */
export const SortableFilterCondition: React.FC<SortableFilterConditionProps> = ({
  condition,
  columns,
  onChange,
  onDelete,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: condition.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={{ ...style, marginBottom: 4 }} {...attributes}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          {...listeners}
          style={{
            cursor: 'grab',
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
            color: '#999',
          }}
        >
          <HolderOutlined />
        </div>
        <div style={{ flex: 1 }}>
          <FilterConditionItem
            condition={condition}
            columns={columns}
            onChange={onChange}
            onDelete={onDelete}
          />
        </div>
      </div>
    </div>
  );
};

