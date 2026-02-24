/**
 * 筛选功能工具函数
 * 
 * 提供筛选条件的验证、转换等通用工具函数
 */

import type { ProColumns } from '@ant-design/pro-components';
import type { FilterCondition, FilterGroup, FilterConfigData, FilterType, FilterOperator, ExtendedProColumns } from './types';
import { FIELD_OPERATOR_MAP } from './types';

/**
 * 根据 valueType 推断筛选器类型
 */
export function inferFilterType(column: ProColumns<any>): FilterType {
  const { valueType, filterConfig } = column;
  
  // 如果手动指定了 filterType，直接使用
  if (filterConfig?.filterType) {
    return filterConfig.filterType;
  }
  
  // 根据 valueType 自动推断
  if (!valueType || valueType === 'text' || valueType === 'textarea') {
    return 'text';
  }
  if (valueType === 'number' || valueType === 'money') {
    return 'number';
  }
  if (valueType === 'date') {
    return 'date';
  }
  if (valueType === 'dateRange') {
    return 'dateRange';
  }
  if (valueType === 'select') {
    return 'select';
  }
  if (valueType === 'switch' || valueType === 'boolean') {
    return 'boolean';
  }
  
  // 默认返回文本类型
  return 'text';
}

/**
 * 获取字段允许的操作符列表
 */
export function getAllowedOperators(column: ProColumns<any>): FilterOperator[] {
  const filterType = inferFilterType(column);
  const { filterConfig } = column as ExtendedProColumns;
  
  // 如果手动指定了 allowedOperators，使用指定的
  if (filterConfig?.allowedOperators && filterConfig.allowedOperators.length > 0) {
    return filterConfig.allowedOperators;
  }
  
  // 否则根据字段类型自动推断
  return FIELD_OPERATOR_MAP[filterType] || FIELD_OPERATOR_MAP.text;
}

/**
 * 获取字段的默认操作符
 */
export function getDefaultOperator(column: ProColumns<any>): FilterOperator {
  const { filterConfig } = column as ExtendedProColumns;
  
  // 如果手动指定了 defaultOperator，使用指定的
  if (filterConfig?.defaultOperator) {
    return filterConfig.defaultOperator;
  }
  
  // 否则根据字段类型选择默认操作符
  const filterType = inferFilterType(column);
  const allowedOperators = getAllowedOperators(column);
  
  // 默认操作符优先级：contains > equals > 第一个可用操作符
  if (allowedOperators.includes('contains')) {
    return 'contains';
  }
  if (allowedOperators.includes('equals')) {
    return 'equals';
  }
  return allowedOperators[0];
}

/**
 * 检查字段是否可筛选
 */
export function isFilterable(column: ProColumns<any>): boolean {
  const { hideInSearch, valueType, filterConfig } = column;
  
  // 如果明确禁用了筛选，返回 false
  if (filterConfig?.enableFilter === false) {
    return false;
  }
  
  // 如果 hideInSearch 为 true，默认不可筛选
  if (hideInSearch === true) {
    return false;
  }
  
  // 操作列不可筛选
  if (valueType === 'option') {
    return false;
  }
  
  // 默认可筛选
  return true;
}

/**
 * 获取所有可筛选的字段
 */
export function getFilterableColumns(columns: ProColumns<any>[]): ProColumns<any>[] {
  return columns.filter(col => isFilterable(col));
}

/**
 * 验证筛选条件
 */
export function validateFilterCondition(
  condition: FilterCondition,
  column: ProColumns<any>
): { valid: boolean; error?: string } {
  // 验证字段是否存在
  if (!column) {
    return { valid: false, error: '字段不存在' };
  }
  
  // 验证字段是否可筛选
  if (!isFilterable(column)) {
    return { valid: false, error: '字段不可筛选' };
  }
  
  // 验证操作符是否允许
  const allowedOperators = getAllowedOperators(column);
  if (!allowedOperators.includes(condition.operator)) {
    return { valid: false, error: '操作符不允许' };
  }
  
  // 验证值（根据操作符和字段类型）
  const filterType = inferFilterType(column);
  
  // 对于 is_empty 和 is_not_empty 操作符，不需要值
  if (condition.operator === 'is_empty' || condition.operator === 'is_not_empty') {
    return { valid: true };
  }
  
  // 对于 between 操作符，值必须是数组且长度为 2
  if (condition.operator === 'between') {
    if (!Array.isArray(condition.value) || condition.value.length !== 2) {
      return { valid: false, error: '范围值必须是包含两个元素的数组' };
    }
    if (filterType === 'number' || filterType === 'date') {
      if (condition.value[0] == null || condition.value[1] == null) {
        return { valid: false, error: '范围值不能为空' };
      }
    }
    return { valid: true };
  }
  
  // 对于其他操作符，值不能为空
  if (condition.value === undefined || condition.value === null || condition.value === '') {
    return { valid: false, error: '筛选值不能为空' };
  }
  
  // 对于数字类型，验证值是否为数字
  if (filterType === 'number') {
    if (typeof condition.value !== 'number' && isNaN(Number(condition.value))) {
      return { valid: false, error: '筛选值必须是数字' };
    }
  }
  
  // 对于选择类型，验证值是否在 valueEnum 中（如果有）
  if (filterType === 'select' && column.valueEnum) {
    const valueEnum = column.valueEnum;
    if (typeof valueEnum === 'object' && !Array.isArray(valueEnum)) {
      const enumKeys = Object.keys(valueEnum);
      if (Array.isArray(condition.value)) {
        // 多选：检查所有值是否都在枚举中
        const invalidValues = condition.value.filter(v => !enumKeys.includes(String(v)));
        if (invalidValues.length > 0) {
          return { valid: false, error: `值 ${invalidValues.join(', ')} 不在允许的选项中` };
        }
      } else {
        // 单选：检查值是否在枚举中
        if (!enumKeys.includes(String(condition.value))) {
          return { valid: false, error: `值 ${condition.value} 不在允许的选项中` };
        }
      }
    }
  }
  
  return { valid: true };
}

/**
 * 转换筛选条件为 API 参数
 */
export function convertFilterConditionToApiParam(
  condition: FilterCondition,
  column: ProColumns<any>
): Record<string, any> {
  const { filterConfig } = column as ExtendedProColumns;
  const filterType = inferFilterType(column);
  const { field, operator, value } = condition;
  
  // 应用筛选值转换函数（如果存在）
  let transformedValue = value;
  if (filterConfig?.filterValueTransform) {
    transformedValue = filterConfig.filterValueTransform(value);
  }
  
  // 根据操作符转换为 API 参数
  const params: Record<string, any> = {};
  
  switch (operator) {
    case 'contains':
      // 包含：使用模糊匹配，字段名作为 key
      params[field] = transformedValue;
      break;
      
    case 'equals':
      // 等于：精确匹配
      params[field] = transformedValue;
      break;
      
    case 'not_equals':
      // 不等于：使用排除参数（如果后端支持）
      params[`${field}__ne`] = transformedValue;
      break;
      
    case 'starts_with':
      // 开头是：使用前缀匹配（如果后端支持）
      params[`${field}__startswith`] = transformedValue;
      break;
      
    case 'ends_with':
      // 结尾是：使用后缀匹配（如果后端支持）
      params[`${field}__endswith`] = transformedValue;
      break;
      
    case 'is_empty':
      // 为空：使用空值检查
      params[`${field}__isnull`] = true;
      break;
      
    case 'is_not_empty':
      // 不为空：使用非空检查
      params[`${field}__isnull`] = false;
      break;
      
    case 'greater_than':
      // 大于
      params[`${field}__gt`] = transformedValue;
      break;
      
    case 'greater_than_or_equal':
      // 大于等于
      params[`${field}__gte`] = transformedValue;
      break;
      
    case 'less_than':
      // 小于
      params[`${field}__lt`] = transformedValue;
      break;
      
    case 'less_than_or_equal':
      // 小于等于
      params[`${field}__lte`] = transformedValue;
      break;
      
    case 'between':
      // 介于：使用范围参数
      if (Array.isArray(transformedValue) && transformedValue.length === 2) {
        params[`${field}__gte`] = transformedValue[0];
        params[`${field}__lte`] = transformedValue[1];
      }
      break;
      
    case 'before':
      // 早于
      params[`${field}__lt`] = transformedValue;
      break;
      
    case 'after':
      // 晚于
      params[`${field}__gt`] = transformedValue;
      break;
      
    case 'today':
    case 'this_week':
    case 'this_month':
    case 'this_year':
      // 日期快捷选项：转换为日期范围
      const dateRange = convertDateShortcutToRange(operator);
      if (dateRange) {
        params[`${field}__gte`] = dateRange[0];
        params[`${field}__lte`] = dateRange[1];
      }
      break;
      
    case 'in':
      // 包含（多选）
      params[field] = Array.isArray(transformedValue) ? transformedValue : [transformedValue];
      break;
      
    case 'not_in':
      // 不包含（排除多选）
      params[`${field}__nin`] = Array.isArray(transformedValue) ? transformedValue : [transformedValue];
      break;
      
    default:
      // 默认：直接使用字段名和值
      params[field] = transformedValue;
  }
  
  return params;
}

/**
 * 转换日期快捷选项为日期范围
 */
function convertDateShortcutToRange(operator: FilterOperator): [string, string] | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (operator) {
    case 'today':
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);
      return [
        today.toISOString().split('T')[0],
        todayEnd.toISOString().split('T')[0],
      ];
      
    case 'this_week':
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      return [
        weekStart.toISOString().split('T')[0],
        weekEnd.toISOString().split('T')[0],
      ];
      
    case 'this_month':
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      monthEnd.setHours(23, 59, 59, 999);
      return [
        monthStart.toISOString().split('T')[0],
        monthEnd.toISOString().split('T')[0],
      ];
      
    case 'this_year':
      const yearStart = new Date(today.getFullYear(), 0, 1);
      const yearEnd = new Date(today.getFullYear(), 11, 31);
      yearEnd.setHours(23, 59, 59, 999);
      return [
        yearStart.toISOString().split('T')[0],
        yearEnd.toISOString().split('T')[0],
      ];
      
    default:
      return null;
  }
}

/**
 * 转换筛选组为 API 参数
 */
export function convertFilterGroupToApiParams(
  group: FilterGroup,
  columns: ProColumns<any>[]
): Record<string, any> {
  const params: Record<string, any> = {};
  
  // 转换条件组中的条件
  group.conditions.forEach(condition => {
    const column = columns.find(col => {
      const dataIndex = col.dataIndex;
      if (typeof dataIndex === 'string') {
        return dataIndex === condition.field;
      }
      if (Array.isArray(dataIndex)) {
        return dataIndex[0] === condition.field;
      }
      return false;
    });
    
    if (column) {
      const conditionParams = convertFilterConditionToApiParam(condition, column);
      Object.assign(params, conditionParams);
    }
  });
  
  // 转换嵌套组（递归）
  if (group.groups && group.groups.length > 0) {
    group.groups.forEach(nestedGroup => {
      const nestedParams = convertFilterGroupToApiParams(nestedGroup, columns);
      // 根据逻辑关系合并参数
      if (group.logic === 'AND') {
        // AND：合并所有参数
        Object.assign(params, nestedParams);
      } else {
        // OR：需要特殊处理（可能需要后端支持 OR 查询）
        // 这里先简单合并，实际使用时可能需要根据后端 API 调整
        Object.assign(params, nestedParams);
      }
    });
  }
  
  return params;
}

/**
 * 转换筛选配置为 API 参数
 */
export function convertFiltersToApiParams(
  filterConfig: FilterConfigData,
  columns: ProColumns<any>[]
): Record<string, any> {
  const params: Record<string, any> = {};
  
  // 转换筛选组为查询参数
  filterConfig.groups.forEach(group => {
    const groupParams = convertFilterGroupToApiParams(group, columns);
    Object.assign(params, groupParams);
  });
  
  // 转换快速筛选为查询参数
  if (filterConfig.quickFilters) {
    Object.keys(filterConfig.quickFilters).forEach(field => {
      const values = filterConfig.quickFilters![field];
      if (values && values.length > 0) {
        // 快速筛选使用等于操作符
        if (values.length === 1) {
          params[field] = values[0];
        } else {
          // 多选：使用 in 操作符
          params[field] = values;
        }
      }
    });
  }
  
  return params;
}

