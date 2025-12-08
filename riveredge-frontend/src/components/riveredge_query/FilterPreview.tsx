/**
 * 筛选条件预览组件
 * 
 * 在表格上方显示当前激活的筛选条件标签
 */

import React, { useMemo } from 'react';
import { Tag, Space, Button, theme } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import type { FilterGroup, FilterConfigData } from './types';
import { OPERATOR_LABEL_MAP } from './types';
import { getFilterableColumns } from './filterUtils';

/**
 * 筛选条件预览组件属性
 */
interface FilterPreviewProps {
  /**
   * 表格列定义
   */
  columns: ProColumns<any>[];
  /**
   * 快速筛选值
   */
  quickFilters: Record<string, any[]>;
  /**
   * 筛选组列表
   */
  filterGroups: FilterGroup[];
  /**
   * 清除快速筛选回调
   */
  onClearQuickFilter: (field: string, value?: any) => void;
  /**
   * 清除所有筛选条件回调
   */
  onClearAll: () => void;
}

/**
 * 筛选条件预览组件
 */
export const FilterPreview: React.FC<FilterPreviewProps> = ({
  columns,
  quickFilters,
  filterGroups,
  onClearQuickFilter,
  onClearAll,
}) => {
  const { token } = theme.useToken();
  
  // 获取可筛选的列
  const filterableColumns = getFilterableColumns(columns);
  
  /**
   * 获取字段标题
   */
  const getFieldTitle = (field: string): string => {
    const column = filterableColumns.find(col => {
      const dataIndex = col.dataIndex;
      if (typeof dataIndex === 'string') {
        return dataIndex === field;
      }
      if (Array.isArray(dataIndex)) {
        return dataIndex[0] === field;
      }
      return false;
    });
    return (column?.title as string) || field;
  };
  
  /**
   * 格式化筛选值
   */
  const formatFilterValue = (value: any, column?: ProColumns<any>): string => {
    if (value === undefined || value === null) {
      return '';
    }
    
    // 如果是数组，格式化数组
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return '';
      }
      // 如果有 valueEnum，显示对应的文本
      if (column?.valueEnum) {
        const enumTexts = value.map(v => {
          const enumValue = column.valueEnum![String(v)];
          if (typeof enumValue === 'object' && enumValue !== null && 'text' in enumValue) {
            return enumValue.text;
          }
          return String(v);
        });
        return enumTexts.join(', ');
      }
      return value.join(', ');
    }
    
    // 如果有 valueEnum，显示对应的文本
    if (column?.valueEnum) {
      const enumValue = column.valueEnum[String(value)];
      if (typeof enumValue === 'object' && enumValue !== null && 'text' in enumValue) {
        return enumValue.text;
      }
    }
    
    return String(value);
  };
  
  /**
   * 生成快速筛选标签
   */
  const quickFilterTags = useMemo(() => {
    const tags: React.ReactNode[] = [];
    
    Object.keys(quickFilters).forEach(field => {
      const values = quickFilters[field];
      if (!values || values.length === 0) {
        return;
      }
      
      const column = filterableColumns.find(col => {
        const dataIndex = col.dataIndex;
        if (typeof dataIndex === 'string') {
          return dataIndex === field;
        }
        if (Array.isArray(dataIndex)) {
          return dataIndex[0] === field;
        }
        return false;
      });
      
      const fieldTitle = getFieldTitle(field);
      const formattedValue = formatFilterValue(values, column);
      
      tags.push(
        <Tag
          key={`quick-${field}`}
          closable
          onClose={() => onClearQuickFilter(field)}
          style={{
            margin: 0,
            padding: '2px 8px',
            backgroundColor: token.colorPrimaryBg,
            color: token.colorPrimary,
            border: `1px solid ${token.colorPrimaryBorder}`,
            borderRadius: token.borderRadius,
          }}
        >
          {fieldTitle}: {formattedValue}
        </Tag>
      );
    });
    
    return tags;
  }, [quickFilters, filterableColumns, token, onClearQuickFilter]);
  
  /**
   * 生成高级筛选标签
   */
  const advancedFilterTags = useMemo(() => {
    const tags: React.ReactNode[] = [];
    
    const processGroup = (group: FilterGroup, groupIndex: number) => {
      group.conditions.forEach((condition, conditionIndex) => {
        const column = filterableColumns.find(col => {
          const dataIndex = col.dataIndex;
          if (typeof dataIndex === 'string') {
            return dataIndex === condition.field;
          }
          if (Array.isArray(dataIndex)) {
            return dataIndex[0] === condition.field;
          }
          return false;
        });
        
        const fieldTitle = getFieldTitle(condition.field);
        const operatorLabel = OPERATOR_LABEL_MAP[condition.operator] || condition.operator;
        
        // 对于 is_empty 和 is_not_empty，不需要显示值
        let valueText = '';
        if (condition.operator !== 'is_empty' && condition.operator !== 'is_not_empty') {
          valueText = formatFilterValue(condition.value, column);
        }
        
        const conditionText = valueText
          ? `${fieldTitle} ${operatorLabel} ${valueText}`
          : `${fieldTitle} ${operatorLabel}`;
        
        tags.push(
          <Tag
            key={`advanced-${group.id}-${condition.id}`}
            closable={false}
            style={{
              margin: 0,
              padding: '2px 8px',
              backgroundColor: token.colorSuccessBg,
              color: token.colorSuccess,
              border: `1px solid ${token.colorSuccessBorder}`,
              borderRadius: token.borderRadius,
            }}
          >
            {conditionText}
          </Tag>
        );
      });
      
      // 处理嵌套组
      if (group.groups && group.groups.length > 0) {
        group.groups.forEach((nestedGroup, nestedIndex) => {
          processGroup(nestedGroup, nestedIndex);
        });
      }
    };
    
    filterGroups.forEach((group, groupIndex) => {
      processGroup(group, groupIndex);
    });
    
    return tags;
  }, [filterGroups, filterableColumns, token]);
  
  // 如果没有筛选条件，不显示
  const hasFilters = Object.keys(quickFilters).length > 0 || filterGroups.length > 0;
  if (!hasFilters) {
    return null;
  }
  
  return (
    <div style={{
      padding: '12px 16px',
      backgroundColor: token.colorFillAlter,
      borderRadius: token.borderRadius,
      border: `1px solid ${token.colorBorderSecondary}`,
      marginBottom: 16,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <span style={{
          fontWeight: 500,
          color: token.colorText,
          fontSize: token.fontSize,
        }}>
          当前筛选条件
        </span>
        <Button
          type="text"
          size="small"
          onClick={onClearAll}
          style={{
            color: token.colorTextSecondary,
            fontSize: token.fontSizeSM,
          }}
        >
          清除全部
        </Button>
      </div>
      
      <Space wrap size={[8, 8]}>
        {quickFilterTags}
        {advancedFilterTags}
      </Space>
    </div>
  );
};

