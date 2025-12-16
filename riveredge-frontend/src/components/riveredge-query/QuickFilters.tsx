/**
 * 快速筛选组件
 * 
 * 提供常用的筛选选项，支持多选和单选
 */

import React from 'react';
import { Space, Tag, Button, theme } from 'antd';
import { ClearOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import type { QuickFilterOption } from './types';
import { getFilterableColumns, inferFilterType } from './filterUtils';

/**
 * 快速筛选组件属性
 */
interface QuickFiltersProps {
  /**
   * 表格列定义
   */
  columns: ProColumns<any>[];
  /**
   * 快速筛选值（字段名 -> 值数组）
   */
  quickFilters: Record<string, any[]>;
  /**
   * 快速筛选值变化回调
   */
  onChange: (quickFilters: Record<string, any[]>) => void;
}

/**
 * 快速筛选组件
 */
export const QuickFilters: React.FC<QuickFiltersProps> = ({
  columns,
  quickFilters,
  onChange,
}) => {
  const { token } = theme.useToken();
  
  // 获取可筛选的列
  const filterableColumns = getFilterableColumns(columns);
  
  // 获取有快速筛选选项的列
  const quickFilterColumns = filterableColumns.filter(col => {
    const filterType = inferFilterType(col);
    // 选择类型字段自动从 valueEnum 生成快速筛选选项
    if (filterType === 'select' && col.valueEnum) {
      return true;
    }
    // 或者手动配置了 quickFilterOptions
    const extendedCol = col as any;
    if (extendedCol.filterConfig?.quickFilterOptions) {
      return true;
    }
    return false;
  });
  
  // 如果没有可用的快速筛选列，不显示
  if (quickFilterColumns.length === 0) {
    return null;
  }
  
  /**
   * 获取快速筛选选项
   */
  const getQuickFilterOptions = (column: ProColumns<any>): QuickFilterOption[] => {
    const extendedCol = column as any;
    
    // 如果手动配置了 quickFilterOptions，使用配置的
    if (extendedCol.filterConfig?.quickFilterOptions) {
      return extendedCol.filterConfig.quickFilterOptions;
    }
    
    // 否则从 valueEnum 自动生成
    if (column.valueEnum && typeof column.valueEnum === 'object' && !Array.isArray(column.valueEnum)) {
      return Object.keys(column.valueEnum).map(key => {
        const enumValue = column.valueEnum![key];
        const label = typeof enumValue === 'object' && enumValue !== null && 'text' in enumValue
          ? enumValue.text
          : String(enumValue);
        return {
          label,
          value: key,
        };
      });
    }
    
    return [];
  };
  
  /**
   * 处理快速筛选值变化
   */
  const handleQuickFilterChange = (field: string, value: any, checked: boolean) => {
    const currentValues = quickFilters[field] || [];
    let newValues: any[];
    
    if (checked) {
      // 添加值
      newValues = [...currentValues, value];
    } else {
      // 移除值
      newValues = currentValues.filter(v => v !== value);
    }
    
    // 更新快速筛选值
    const newQuickFilters = { ...quickFilters };
    if (newValues.length > 0) {
      newQuickFilters[field] = newValues;
    } else {
      delete newQuickFilters[field];
    }
    
    onChange(newQuickFilters);
  };
  
  /**
   * 清除所有快速筛选
   */
  const handleClearAll = () => {
    onChange({});
  };
  
  // 检查是否有激活的快速筛选
  const hasActiveFilters = Object.keys(quickFilters).length > 0;
  
  return (
    <div style={{ 
      marginBottom: 16, 
      padding: '12px 16px', 
      backgroundColor: token.colorFillAlter,
      borderRadius: token.borderRadius,
      border: `1px solid ${token.colorBorderSecondary}`,
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: 12,
        height: 32, // 固定高度，避免按钮显示/隐藏时高度变化
      }}>
        <span style={{ 
          fontWeight: 500, 
          color: token.colorText,
          fontSize: token.fontSize,
        }}>
          快速筛选
        </span>
        <div style={{ 
          height: 32, // 固定高度容器
          display: 'flex',
          alignItems: 'center',
        }}>
          {hasActiveFilters ? (
            <Button
              type="text"
              size="small"
              icon={<ClearOutlined />}
              onClick={handleClearAll}
              style={{ 
                color: token.colorTextSecondary,
                fontSize: token.fontSizeSM,
              }}
            >
              清除全部
            </Button>
          ) : (
            <div style={{ width: 0, height: 32 }} /> // 占位元素，保持高度一致
          )}
        </div>
      </div>
      
      <Space wrap size={[8, 8]}>
        {quickFilterColumns.map(column => {
          const dataIndex = column.dataIndex;
          const field = typeof dataIndex === 'string' ? dataIndex : Array.isArray(dataIndex) ? dataIndex[0] : '';
          if (!field) return null;
          
          const options = getQuickFilterOptions(column);
          if (options.length === 0) return null;
          
          const currentValues = quickFilters[field] || [];
          
          return (
            <div key={field} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ 
                color: token.colorTextSecondary,
                fontSize: token.fontSizeSM,
                marginRight: 4,
              }}>
                {column.title as string}:
              </span>
              <Space wrap size={[4, 4]}>
                {options.map(option => {
                  const isSelected = currentValues.includes(option.value);
                  return (
                    <Tag
                      key={option.value}
                      style={{
                        cursor: 'pointer',
                        margin: 0,
                        padding: '2px 8px',
                        backgroundColor: isSelected ? token.colorPrimaryBg : token.colorBgContainer,
                        color: isSelected ? token.colorPrimary : token.colorText,
                        border: `1px solid ${isSelected ? token.colorPrimary : token.colorBorder}`,
                        borderRadius: token.borderRadius,
                      }}
                      onClick={() => handleQuickFilterChange(field, option.value, !isSelected)}
                    >
                      {option.icon}
                      {option.icon && <span style={{ marginLeft: 4 }} />}
                      {option.label}
                    </Tag>
                  );
                })}
              </Space>
            </div>
          );
        })}
      </Space>
    </div>
  );
};

