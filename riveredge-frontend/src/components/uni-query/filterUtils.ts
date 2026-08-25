/**
 * 筛选功能工具函数
 * 
 * 提供筛选条件的验证、转换等通用工具函数
 */

import type { ProColumns } from '@ant-design/pro-components';
import type { FilterCondition, FilterGroup, FilterConfigData, FilterType, FilterOperator, ExtendedProColumns } from './types';
import { FIELD_OPERATOR_MAP } from './types';
import {
  mapFilterOperatorToColumnFilterOp,
  mergeColumnFilters,
  parseColumnFiltersParam,
  serializeColumnFiltersParam,
  type AdvancedColumnFilter,
} from './columnFilterContract';

/**
 * 根据 valueType 推断筛选器类型
 */
export function inferFilterType(column: ProColumns<any>): FilterType {
  const ext = column as ExtendedProColumns;
  const { valueType, filterConfig } = ext;
  const vt = String(valueType ?? '');

  // 如果手动指定了 filterType，直接使用
  if (filterConfig?.filterType) {
    return filterConfig.filterType;
  }

  // 根据 valueType 自动推断（union 不完全包含 digit/boolean 等，按字符串比对）
  if (!vt || vt === 'text' || vt === 'textarea') {
    return 'text';
  }
  if (vt === 'digit' || vt === 'money' || vt === 'number') {
    return 'number';
  }
  if (vt === 'date') {
    return 'date';
  }
  if (vt === 'dateRange') {
    return 'dateRange';
  }
  if (vt === 'select') {
    return 'select';
  }
  if (vt === 'switch' || vt === 'boolean') {
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
  const ext = column as ExtendedProColumns;
  const { hideInSearch, filterConfig } = ext;
  const valueType = ext.valueType;
  
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
 * 转换筛选条件为 column_filters 条目（高级搜索唯一契约）。
 */
export function convertFilterConditionToColumnFilter(
  condition: FilterCondition,
  column: ProColumns<any>,
): AdvancedColumnFilter | null {
  const { filterConfig } = column as ExtendedProColumns;
  const { field, operator, value } = condition;
  const op = mapFilterOperatorToColumnFilterOp(operator);
  if (!op || !field) return null;

  let transformedValue = value;
  if (filterConfig?.filterValueTransform) {
    transformedValue = filterConfig.filterValueTransform(value);
  }

  if (operator === 'is_empty') {
    return { field, op: 'isnull', value: true };
  }
  if (operator === 'is_not_empty') {
    return { field, op: 'isnull', value: false };
  }

  if (
    operator === 'today' ||
    operator === 'this_week' ||
    operator === 'this_month' ||
    operator === 'this_year'
  ) {
    const dateRange = convertDateShortcutToRange(operator);
    if (!dateRange) return null;
    return { field, op: 'between', value: dateRange[0], value_to: dateRange[1] };
  }

  if (operator === 'between') {
    if (!Array.isArray(transformedValue) || transformedValue.length !== 2) return null;
    return {
      field,
      op: 'between',
      value: transformedValue[0] as string | number,
      value_to: transformedValue[1] as string | number,
    };
  }

  if (operator === 'in' || operator === 'not_in') {
    const arr = Array.isArray(transformedValue) ? transformedValue : [transformedValue];
    return {
      field,
      op,
      value: arr.map((v) => (v == null ? '' : String(v))),
    };
  }

  return {
    field,
    op,
    value: transformedValue as string | number | boolean,
  };
}

/**
 * 转换筛选条件为 API 参数（column_filters 契约）。
 */
export function convertFilterConditionToApiParam(
  condition: FilterCondition,
  column: ProColumns<any>,
): Record<string, any> {
  const entry = convertFilterConditionToColumnFilter(condition, column);
  if (!entry) return {};
  return {
    column_filters: serializeColumnFiltersParam([entry]),
  };
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
 * 转换筛选组为 column_filters 条目列表
 */
export function collectColumnFiltersFromGroup(
  group: FilterGroup,
  columns: ProColumns<any>[],
): AdvancedColumnFilter[] {
  const entries: AdvancedColumnFilter[] = [];

  group.conditions.forEach((condition) => {
    const column = columns.find((col) => {
      const dataIndex = col.dataIndex;
      if (typeof dataIndex === 'string') {
        return dataIndex === condition.field;
      }
      if (Array.isArray(dataIndex)) {
        return dataIndex[0] === condition.field;
      }
      return false;
    });
    if (!column) return;
    const entry = convertFilterConditionToColumnFilter(condition, column);
    if (entry) entries.push(entry);
  });

  if (group.groups && group.groups.length > 0) {
    group.groups.forEach((nestedGroup) => {
      entries.push(...collectColumnFiltersFromGroup(nestedGroup, columns));
    });
  }

  return entries;
}

/**
 * 转换筛选组为 API 参数（仅聚合 column_filters）
 */
export function convertFilterGroupToApiParams(
  group: FilterGroup,
  columns: ProColumns<any>[],
): Record<string, any> {
  const entries = collectColumnFiltersFromGroup(group, columns);
  const serialized = serializeColumnFiltersParam(entries);
  return serialized ? { column_filters: serialized } : {};
}

/**
 * 转换筛选配置为 API 参数。
 * 高级条件唯一写入 column_filters；快速筛选仍写普通字段（工具栏快捷条件）。
 */
export function convertFiltersToApiParams(
  filterConfig: FilterConfigData,
  columns: ProColumns<any>[],
): Record<string, any> {
  const params: Record<string, any> = {};
  const advanced: AdvancedColumnFilter[] = [];

  filterConfig.groups.forEach((group) => {
    advanced.push(...collectColumnFiltersFromGroup(group, columns));
  });

  // 快速筛选：写入普通字段，并同步一条 eq/in 进 column_filters，避免报表只认 column_filters 时漏筛
  if (filterConfig.quickFilters) {
    Object.keys(filterConfig.quickFilters).forEach((field) => {
      const values = filterConfig.quickFilters![field];
      if (!values || values.length === 0) return;
      if (values.length === 1) {
        params[field] = values[0];
        advanced.push({ field, op: 'eq', value: values[0] as string | number });
      } else {
        params[field] = values;
        advanced.push({ field, op: 'in', value: values.map(String) });
      }
    });
  }

  const existing = parseColumnFiltersParam(params.column_filters);
  const merged = mergeColumnFilters(existing, advanced);
  const serialized = serializeColumnFiltersParam(merged);
  if (serialized) {
    params.column_filters = serialized;
  } else {
    delete params.column_filters;
  }

  return params;
}

