/**
 * 高级筛选组件
 * 
 * 支持复杂的筛选条件组合，包括条件组和嵌套组
 */

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Space, Select, theme } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import type { FilterCondition, FilterGroup } from './types';
import { FilterGroupItem } from './FilterGroupItem';
import { getFilterableColumns, getDefaultOperator } from './filterUtils';
/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 高级筛选组件属性
 */
interface AdvancedFiltersProps {
  /**
   * 表格列定义
   */
  columns: ProColumns<any>[];
  /**
   * 筛选组列表
   */
  filterGroups: FilterGroup[];
  /**
   * 筛选组变化回调
   */
  onChange: (filterGroups: FilterGroup[]) => void;
}

/**
 * 高级筛选组件
 */
export const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({
  columns,
  filterGroups,
  onChange,
}) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  
  // 获取可筛选的列
  const filterableColumns = getFilterableColumns(columns);
  
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
   * 添加新的筛选条件组
   */
  const handleAddGroup = () => {
    const newGroup: FilterGroup = {
      id: generateId(),
      logic: 'AND',
      conditions: [createNewCondition()],
    };
    onChange([...filterGroups, newGroup]);
  };
  
  /**
   * 删除筛选条件组
   */
  const handleDeleteGroup = (groupId: string) => {
    onChange(filterGroups.filter(group => group.id !== groupId));
  };
  
  /**
   * 更新筛选条件组
   */
  const handleUpdateGroup = (groupId: string, updatedGroup: FilterGroup) => {
    onChange(filterGroups.map(group => 
      group.id === groupId ? updatedGroup : group
    ));
  };
  
  // 如果没有筛选组，显示空状态
  if (filterGroups.length === 0) {
    return (
      <div style={{
        padding: '24px',
        textAlign: 'center',
        color: token.colorTextSecondary,
        backgroundColor: token.colorFillAlter,
        borderRadius: token.borderRadius,
        border: `1px dashed ${token.colorBorderSecondary}`,
      }}>
        <p style={{ marginBottom: 16 }}>{t('components.uniQuery.noFilters')}</p>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAddGroup}
        >
          {t('components.uniQuery.addFilterGroup')}
        </Button>
      </div>
    );
  }
  
  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 500, color: token.colorText }}>{t('components.uniQuery.advancedFilter')}</span>
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={handleAddGroup}
          size="small"
        >
          {t('components.uniQuery.addConditionGroup')}
        </Button>
      </div>
      
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        {filterGroups.map((group, groupIndex) => (
          <FilterGroupItem
            key={group.id}
            columns={columns}
            group={group}
            groupIndex={groupIndex}
            level={0}
            onChange={(updatedGroup) => handleUpdateGroup(group.id, updatedGroup)}
            onDelete={() => handleDeleteGroup(group.id)}
          />
        ))}
      </Space>
    </div>
  );
};

