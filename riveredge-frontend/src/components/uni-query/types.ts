/**
 * 高级搜索筛选功能类型定义
 * 
 * 提供筛选功能的通用类型定义，支持所有业务场景
 */

import type { ProColumns } from '@ant-design/pro-components';

/**
 * 快速筛选选项
 */
export interface QuickFilterOption {
  /**
   * 选项标签
   */
  label: string;
  /**
   * 选项值
   */
  value: any;
  /**
   * 选项图标（可选）
   */
  icon?: React.ReactNode;
}

/**
 * 筛选操作符类型
 */
export type FilterOperator = 
  // 文本字段操作符
  | 'contains'        // 包含
  | 'equals'         // 等于
  | 'not_equals'     // 不等于
  | 'starts_with'    // 开头是
  | 'ends_with'      // 结尾是
  | 'is_empty'       // 为空
  | 'is_not_empty'   // 不为空
  // 数字字段操作符
  | 'greater_than'           // 大于
  | 'greater_than_or_equal' // 大于等于
  | 'less_than'              // 小于
  | 'less_than_or_equal'     // 小于等于
  | 'between'                // 介于
  // 日期字段操作符
  | 'before'         // 早于
  | 'after'          // 晚于
  | 'today'          // 今天
  | 'this_week'      // 本周
  | 'this_month'     // 本月
  | 'this_year'      // 本年
  // 选择字段操作符
  | 'in'             // 包含（多选）
  | 'not_in';        // 不包含（排除多选）

/**
 * 筛选器类型
 */
export type FilterType = 'text' | 'number' | 'date' | 'select' | 'boolean' | 'dateRange';

/**
 * 筛选配置（扩展 ProColumns）
 */
export interface FilterConfig {
  /**
   * 是否启用筛选（默认：true，根据 hideInSearch 自动推断）
   */
  enableFilter?: boolean;
  /**
   * 筛选器类型（自动推断或手动指定）
   * 如果不指定，根据 valueType 自动推断：
   * - text/textarea → 'text'
   * - number/money → 'number'
   * - date → 'date'
   * - dateRange → 'dateRange'
   * - select → 'select'
   * - switch → 'boolean'
   */
  filterType?: FilterType;
  /**
   * 快速筛选选项（用于快速筛选区域）
   * 如果不指定，对于 select 类型字段，会从 valueEnum 自动生成
   */
  quickFilterOptions?: QuickFilterOption[];
  /**
   * 默认筛选操作符（可选）
   */
  defaultOperator?: FilterOperator;
  /**
   * 允许的筛选操作符列表（可选）
   * 如果不指定，根据字段类型自动推断
   */
  allowedOperators?: FilterOperator[];
  /**
   * 筛选值转换函数（可选）
   * 用于在筛选值传递给后端 API 之前进行转换
   */
  filterValueTransform?: (value: any) => any;
}

/**
 * 扩展的 ProColumns 类型（包含筛选配置）
 */
export interface ExtendedProColumns<T = any> extends ProColumns<T> {
  /**
   * 筛选配置（可选）
   */
  filterConfig?: FilterConfig;
}

/**
 * 筛选条件
 */
export interface FilterCondition {
  /**
   * 条件唯一标识
   */
  id: string;
  /**
   * 字段名（对应 columns 的 dataIndex）
   */
  field: string;
  /**
   * 操作符
   */
  operator: FilterOperator;
  /**
   * 筛选值
   */
  value: any;
  /**
   * 值类型（用于验证和转换）
   */
  valueType?: string;
}

/**
 * 筛选条件组
 */
export interface FilterGroup {
  /**
   * 组唯一标识
   */
  id: string;
  /**
   * 逻辑关系
   */
  logic: 'AND' | 'OR';
  /**
   * 条件列表
   */
  conditions: FilterCondition[];
  /**
   * 嵌套组（可选）
   */
  groups?: FilterGroup[];
}

/**
 * 筛选配置（完整）
 */
export interface FilterConfigData {
  /**
   * 筛选组列表
   */
  groups: FilterGroup[];
  /**
   * 快速筛选值（字段名 -> 值数组）
   */
  quickFilters?: Record<string, any[]>;
}

/**
 * 字段操作符映射（根据字段类型自动推断）
 */
export const FIELD_OPERATOR_MAP: Record<FilterType, FilterOperator[]> = {
  text: ['contains', 'equals', 'not_equals', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty'],
  number: ['equals', 'not_equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal', 'between', 'is_empty', 'is_not_empty'],
  date: ['equals', 'not_equals', 'before', 'after', 'today', 'this_week', 'this_month', 'this_year', 'is_empty', 'is_not_empty'],
  dateRange: ['between', 'is_empty', 'is_not_empty'],
  select: ['equals', 'not_equals', 'in', 'not_in', 'is_empty', 'is_not_empty'],
  boolean: ['equals', 'not_equals', 'is_empty', 'is_not_empty'],
};

/**
 * 操作符标签映射（中文，用于无 i18n 场景的兜底）
 */
export const OPERATOR_LABEL_MAP: Record<FilterOperator, string> = {
  contains: '包含',
  equals: '等于',
  not_equals: '不等于',
  starts_with: '开头是',
  ends_with: '结尾是',
  is_empty: '为空',
  is_not_empty: '不为空',
  greater_than: '大于',
  greater_than_or_equal: '大于等于',
  less_than: '小于',
  less_than_or_equal: '小于等于',
  between: '介于',
  before: '早于',
  after: '晚于',
  today: '今天',
  this_week: '本周',
  this_month: '本月',
  this_year: '本年',
  in: '包含',
  not_in: '不包含',
};

/** 操作符 i18n 键映射（用于 useTranslation） */
export const OPERATOR_I18N_KEY_MAP: Record<FilterOperator, string> = {
  contains: 'components.uniQuery.operatorContains',
  equals: 'components.uniQuery.operatorEquals',
  not_equals: 'components.uniQuery.operatorNotEquals',
  starts_with: 'components.uniQuery.operatorStartsWith',
  ends_with: 'components.uniQuery.operatorEndsWith',
  is_empty: 'components.uniQuery.operatorIsEmpty',
  is_not_empty: 'components.uniQuery.operatorIsNotEmpty',
  greater_than: 'components.uniQuery.operatorGreaterThan',
  greater_than_or_equal: 'components.uniQuery.operatorGreaterThanOrEqual',
  less_than: 'components.uniQuery.operatorLessThan',
  less_than_or_equal: 'components.uniQuery.operatorLessThanOrEqual',
  between: 'components.uniQuery.operatorBetween',
  before: 'components.uniQuery.operatorBefore',
  after: 'components.uniQuery.operatorAfter',
  today: 'components.uniQuery.operatorToday',
  this_week: 'components.uniQuery.operatorThisWeek',
  this_month: 'components.uniQuery.operatorThisMonth',
  this_year: 'components.uniQuery.operatorThisYear',
  in: 'components.uniQuery.operatorIn',
  not_in: 'components.uniQuery.operatorNotIn',
};

