/**
 * 筛选条件项组件
 * 
 * 单个筛选条件的编辑组件
 */

import React, { useMemo } from 'react';
import { Space, Select, Input, DatePicker, InputNumber, Button, theme, Tooltip } from 'antd';
import { DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import type { FilterCondition, FilterOperator } from './types';
import { 
  getFilterableColumns, 
  getAllowedOperators, 
  getDefaultOperator,
  inferFilterType,
  validateFilterCondition,
} from './filterUtils';
import { OPERATOR_LABEL_MAP } from './types';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

/**
 * 筛选条件项组件属性
 */
interface FilterConditionProps {
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
 * 筛选条件项组件
 */
export const FilterConditionItem: React.FC<FilterConditionProps> = ({
  condition,
  columns,
  onChange,
  onDelete,
}) => {
  const { token } = theme.useToken();
  
  // 获取可筛选的列
  const filterableColumns = getFilterableColumns(columns);
  
  // 获取当前字段的列定义
  const currentColumn = useMemo(() => {
    return filterableColumns.find(col => {
      const dataIndex = col.dataIndex;
      if (typeof dataIndex === 'string') {
        return dataIndex === condition.field;
      }
      if (Array.isArray(dataIndex)) {
        return dataIndex[0] === condition.field;
      }
      return false;
    });
  }, [condition.field, filterableColumns]);
  
  // 获取字段类型和允许的操作符
  const filterType = currentColumn ? inferFilterType(currentColumn) : 'text';
  const allowedOperators = currentColumn ? getAllowedOperators(currentColumn) : [];
  
  // 验证条件
  const validation = currentColumn ? validateFilterCondition(condition, currentColumn) : { valid: true };
  
  /**
   * 处理字段变化
   */
  const handleFieldChange = (field: string) => {
    const newColumn = filterableColumns.find(col => {
      const dataIndex = col.dataIndex;
      if (typeof dataIndex === 'string') {
        return dataIndex === field;
      }
      if (Array.isArray(dataIndex)) {
        return dataIndex[0] === field;
      }
      return false;
    });
    
    if (newColumn) {
      const newFilterType = inferFilterType(newColumn);
      const newAllowedOperators = getAllowedOperators(newColumn);
      const newDefaultOperator = getDefaultOperator(newColumn);
      
      // 更新条件：字段、操作符、值
      onChange({
        ...condition,
        field,
        operator: newAllowedOperators.includes(condition.operator) 
          ? condition.operator 
          : newDefaultOperator,
        value: undefined, // 切换字段时清空值
        valueType: newFilterType,
      });
    }
  };
  
  /**
   * 处理操作符变化
   */
  const handleOperatorChange = (operator: FilterOperator) => {
    // 对于 is_empty 和 is_not_empty 操作符，清空值
    const newValue = (operator === 'is_empty' || operator === 'is_not_empty') 
      ? undefined 
      : condition.value;
    
    onChange({
      ...condition,
      operator,
      value: newValue,
    });
  };
  
  /**
   * 处理值变化
   */
  const handleValueChange = (value: any) => {
    onChange({
      ...condition,
      value,
    });
  };
  
  /**
   * 渲染值输入组件
   */
  const renderValueInput = () => {
    // 对于 is_empty 和 is_not_empty 操作符，不需要值输入
    if (condition.operator === 'is_empty' || condition.operator === 'is_not_empty') {
      return null;
    }
    
    switch (filterType) {
      case 'text':
        return (
          <Input
            value={condition.value}
            onChange={(e) => handleValueChange(e.target.value)}
            placeholder="请输入筛选值"
            style={{ width: 200 }}
          />
        );
        
      case 'number':
        if (condition.operator === 'between') {
          return (
            <Input.Group compact>
              <InputNumber
                value={Array.isArray(condition.value) ? condition.value[0] : undefined}
                onChange={(value) => handleValueChange([value, Array.isArray(condition.value) ? condition.value[1] : undefined])}
                placeholder="最小值"
                style={{ width: '50%' }}
              />
              <InputNumber
                value={Array.isArray(condition.value) ? condition.value[1] : undefined}
                onChange={(value) => handleValueChange([Array.isArray(condition.value) ? condition.value[0] : undefined, value])}
                placeholder="最大值"
                style={{ width: '50%' }}
              />
            </Input.Group>
          );
        }
        return (
          <InputNumber
            value={condition.value}
            onChange={handleValueChange}
            placeholder="请输入数字"
            style={{ width: 200 }}
          />
        );
        
      case 'date':
        if (condition.operator === 'between') {
          return (
            <RangePicker
              value={Array.isArray(condition.value) && condition.value.length === 2
                ? [dayjs(condition.value[0]), dayjs(condition.value[1])]
                : null}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  handleValueChange([
                    dates[0].format('YYYY-MM-DD'),
                    dates[1].format('YYYY-MM-DD'),
                  ]);
                } else {
                  handleValueChange(undefined);
                }
              }}
              style={{ width: 300 }}
            />
          );
        }
        return (
          <DatePicker
            value={condition.value ? dayjs(condition.value) : null}
            onChange={(date) => handleValueChange(date ? date.format('YYYY-MM-DD') : undefined)}
            placeholder="请选择日期"
            style={{ width: 200 }}
          />
        );
        
      case 'dateRange':
        return (
          <RangePicker
            value={Array.isArray(condition.value) && condition.value.length === 2
              ? [dayjs(condition.value[0]), dayjs(condition.value[1])]
              : null}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                handleValueChange([
                  dates[0].format('YYYY-MM-DD'),
                  dates[1].format('YYYY-MM-DD'),
                ]);
              } else {
                handleValueChange(undefined);
              }
            }}
            style={{ width: 300 }}
          />
        );
        
      case 'select':
        if (!currentColumn?.valueEnum) {
          return null;
        }
        
        const valueEnum = currentColumn.valueEnum;
        const options = typeof valueEnum === 'object' && !Array.isArray(valueEnum)
          ? Object.keys(valueEnum).map(key => {
              const enumValue = valueEnum[key];
              const label = typeof enumValue === 'object' && enumValue !== null && 'text' in enumValue
                ? enumValue.text
                : String(enumValue);
              return { label, value: key };
            })
          : [];
        
        // 对于 in 和 not_in 操作符，支持多选
        if (condition.operator === 'in' || condition.operator === 'not_in') {
          return (
            <Select
              mode="multiple"
              value={Array.isArray(condition.value) ? condition.value : condition.value ? [condition.value] : []}
              onChange={handleValueChange}
              options={options}
              placeholder="请选择选项"
              style={{ width: 200 }}
            />
          );
        }
        
        return (
          <Select
            value={condition.value}
            onChange={handleValueChange}
            options={options}
            placeholder="请选择选项"
            style={{ width: 200 }}
          />
        );
        
      case 'boolean':
        return (
          <Select
            value={condition.value}
            onChange={handleValueChange}
            options={[
              { label: '是', value: true },
              { label: '否', value: false },
            ]}
            placeholder="请选择"
            style={{ width: 200 }}
          />
        );
        
      default:
        return (
          <Input
            value={condition.value}
            onChange={(e) => handleValueChange(e.target.value)}
            placeholder="请输入筛选值"
            style={{ width: 200 }}
          />
        );
    }
  };
  
  // 字段选项
  const fieldOptions = filterableColumns.map(col => {
    const dataIndex = col.dataIndex;
    const field = typeof dataIndex === 'string' ? dataIndex : Array.isArray(dataIndex) ? dataIndex[0] : '';
    return {
      label: col.title as string,
      value: field,
    };
  }).filter(opt => opt.value);
  
  // 操作符选项
  const operatorOptions = allowedOperators.map(op => ({
    label: OPERATOR_LABEL_MAP[op],
    value: op,
  }));
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
      padding: '6px 8px',
      backgroundColor: token.colorFillAlter,
      borderRadius: token.borderRadius,
      border: `1px solid ${validation.valid ? token.colorBorderSecondary : token.colorError}`,
    }}>
      <Select
        value={condition.field}
        onChange={handleFieldChange}
        options={fieldOptions}
        placeholder="选择字段"
        style={{ width: 150 }}
      />
      <Select
        value={condition.operator}
        onChange={handleOperatorChange}
        options={operatorOptions}
        placeholder="选择操作符"
        style={{ width: 80 }}
      />
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
        {renderValueInput()}
        {!validation.valid && validation.error && (
          <Tooltip title={validation.error} placement="topRight">
            <ExclamationCircleOutlined 
              style={{ 
                marginLeft: 8,
                color: token.colorError,
                fontSize: token.fontSize,
                flexShrink: 0,
              }} 
            />
          </Tooltip>
        )}
      </div>
      <Button
        type="text"
        danger
        icon={<DeleteOutlined />}
        onClick={onDelete}
        style={{ flexShrink: 0 }}
      />
    </div>
  );
};

