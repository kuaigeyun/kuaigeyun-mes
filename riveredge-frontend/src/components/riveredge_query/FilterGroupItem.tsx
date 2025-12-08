/**
 * 筛选条件组组件（支持嵌套）
 * 
 * 支持最多 3 层嵌套的条件组
 */

import React, { useCallback } from 'react';
import { Button, Space, Select, theme } from 'antd';
import { PlusOutlined, DeleteOutlined, HolderOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import type { FilterCondition, FilterGroup } from './types';
import { SortableFilterCondition } from './SortableFilterCondition';
import { getFilterableColumns, getDefaultOperator } from './filterUtils';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 筛选条件组组件属性
 */
interface FilterGroupItemProps {
  /**
   * 表格列定义
   */
  columns: ProColumns<any>[];
  /**
   * 筛选条件组
   */
  group: FilterGroup;
  /**
   * 组索引（用于显示）
   */
  groupIndex: number;
  /**
   * 嵌套层级（0 为顶级，最多 2 层：顶级组 + 1层嵌套组）
   */
  level: number;
  /**
   * 组变化回调
   */
  onChange: (group: FilterGroup) => void;
  /**
   * 删除组回调
   */
  onDelete: () => void;
}

/**
 * 筛选条件组组件
 */
export const FilterGroupItem: React.FC<FilterGroupItemProps> = ({
  columns,
  group,
  groupIndex,
  level,
  onChange,
  onDelete,
}) => {
  const { token } = theme.useToken();
  
  // 获取可筛选的列
  const filterableColumns = getFilterableColumns(columns);
  
  // 拖拽传感器
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // 最大嵌套层级（2层嵌套：顶级组 + 1层嵌套组）
  const MAX_LEVEL = 2;
  
  /**
   * 创建新的筛选条件
   */
  const createNewCondition = useCallback((field?: string): FilterCondition => {
    const defaultColumn = field 
      ? filterableColumns.find(col => {
          const dataIndex = col.dataIndex;
          if (typeof dataIndex === 'string') {
            return dataIndex === field;
          }
          if (Array.isArray(dataIndex)) {
            return dataIndex[0] === field;
          }
          return false;
        })
      : filterableColumns[0];
    
    if (!defaultColumn) {
      throw new Error('没有可用的筛选字段');
    }
    
    const dataIndex = defaultColumn.dataIndex;
    const defaultField = typeof dataIndex === 'string' ? dataIndex : Array.isArray(dataIndex) ? dataIndex[0] : '';
    
    return {
      id: generateId(),
      field: field || defaultField,
      operator: getDefaultOperator(defaultColumn),
      value: undefined,
      valueType: defaultColumn.valueType as string,
    };
  }, [filterableColumns]);
  
  /**
   * 处理逻辑关系变化
   */
  const handleLogicChange = (logic: 'AND' | 'OR') => {
    onChange({ ...group, logic });
  };
  
  /**
   * 添加筛选条件
   */
  const handleAddCondition = () => {
    onChange({
      ...group,
      conditions: [...group.conditions, createNewCondition()],
    });
  };
  
  /**
   * 更新筛选条件
   */
  const handleUpdateCondition = (conditionId: string, condition: FilterCondition) => {
    onChange({
      ...group,
      conditions: group.conditions.map(cond =>
        cond.id === conditionId ? condition : cond
      ),
    });
  };
  
  /**
   * 删除筛选条件
   */
  const handleDeleteCondition = (conditionId: string) => {
    onChange({
      ...group,
      conditions: group.conditions.filter(cond => cond.id !== conditionId),
    });
  };
  
  /**
   * 处理条件拖拽结束
   */
  const handleConditionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = group.conditions.findIndex(cond => cond.id === active.id);
      const newIndex = group.conditions.findIndex(cond => cond.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        onChange({
          ...group,
          conditions: arrayMove(group.conditions, oldIndex, newIndex),
        });
      }
    }
  };
  
  /**
   * 添加嵌套组
   */
  const handleAddNestedGroup = () => {
    if (level >= MAX_LEVEL) {
      return; // 已达到最大嵌套层级
    }
    
    const newNestedGroup: FilterGroup = {
      id: generateId(),
      logic: 'AND',
      conditions: [createNewCondition()],
    };
    
    onChange({
      ...group,
      groups: [...(group.groups || []), newNestedGroup],
    });
  };
  
  /**
   * 更新嵌套组
   */
  const handleUpdateNestedGroup = (nestedGroupId: string, nestedGroup: FilterGroup) => {
    onChange({
      ...group,
      groups: (group.groups || []).map(g =>
        g.id === nestedGroupId ? nestedGroup : g
      ),
    });
  };
  
  /**
   * 删除嵌套组
   */
  const handleDeleteNestedGroup = (nestedGroupId: string) => {
    onChange({
      ...group,
      groups: (group.groups || []).filter(g => g.id !== nestedGroupId),
    });
  };
  
  // 计算缩进（根据层级）
  const indent = level * 24;
  
  return (
    <div
      style={{
        padding: '8px 12px',
        backgroundColor: token.colorBgContainer,
        borderRadius: token.borderRadius,
        border: `1px solid ${token.colorBorderSecondary}`,
        marginLeft: indent,
        position: 'relative',
      }}
    >
      {/* 层级指示线 */}
      {level > 0 && (
        <div
          style={{
            position: 'absolute',
            left: -12,
            top: 0,
            bottom: 0,
            width: 2,
            backgroundColor: token.colorPrimary,
            borderRadius: 1,
          }}
        />
      )}
      
      {/* 组头部 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>
            {level === 0 ? `条件组 ${groupIndex + 1}` : `嵌套组 ${groupIndex + 1}`}
          </span>
          <Select
            value={group.logic}
            onChange={handleLogicChange}
            options={[
              { label: 'AND（所有条件都满足）', value: 'AND' },
              { label: 'OR（任一条件满足）', value: 'OR' },
            ]}
            size="small"
            style={{ width: 180 }}
          />
        </div>
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={onDelete}
          size="small"
        >
          删除组
        </Button>
      </div>
      
      {/* 条件和嵌套组 */}
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        {/* 筛选条件（支持拖拽排序） */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleConditionDragEnd}
        >
          <SortableContext
            items={group.conditions.map(cond => cond.id)}
            strategy={verticalListSortingStrategy}
          >
            {group.conditions.map((condition) => (
              <SortableFilterCondition
                key={condition.id}
                condition={condition}
                columns={columns}
                onChange={(updatedCondition) => 
                  handleUpdateCondition(condition.id, updatedCondition)
                }
                onDelete={() => handleDeleteCondition(condition.id)}
              />
            ))}
          </SortableContext>
        </DndContext>
        
        {/* 嵌套组 */}
        {group.groups && group.groups.length > 0 && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {group.groups.map((nestedGroup, nestedIndex) => (
              <FilterGroupItem
                key={nestedGroup.id}
                columns={columns}
                group={nestedGroup}
                groupIndex={nestedIndex}
                level={level + 1}
                onChange={(updatedGroup) => 
                  handleUpdateNestedGroup(nestedGroup.id, updatedGroup)
                }
                onDelete={() => handleDeleteNestedGroup(nestedGroup.id)}
              />
            ))}
          </Space>
        )}
        
        {/* 操作按钮 */}
        <Space size={8} style={{ width: '100%' }}>
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={handleAddCondition}
            size="small"
          >
            添加条件
          </Button>
          {level < MAX_LEVEL && (
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={handleAddNestedGroup}
              size="small"
            >
              添加嵌套组
            </Button>
          )}
        </Space>
      </Space>
    </div>
  );
};

