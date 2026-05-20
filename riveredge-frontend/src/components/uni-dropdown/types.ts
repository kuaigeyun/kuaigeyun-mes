/**
 * UniDropdown 组件类型定义
 *
 * 管理型下拉（客户、物料等）的「快速新建」「高级搜索」配置类型。
 */

import type { ReactNode } from 'react';

export interface QuickCreateConfig {
  /** 菜单项文案，默认「快速新建」 */
  label?: string;
  /**
   * 点击时触发；anchorEl 为下拉外侧包裹层（与 Select 同宽），用于 Popover 对齐字段。
   * 忽略参数时仍兼容 `() => void` 写法。
   */
  onClick: (anchorEl?: HTMLElement | null) => void;
}

export interface QuickEditConfig {
  /** 编辑按钮 tooltip，默认「快速编辑」 */
  label?: string;
  /** 点击选项行右侧编辑图标；value 为当前选项 value */
  onEdit: (value: any, option?: { value?: any; label?: ReactNode }, anchorEl?: HTMLElement | null) => void;
}

export interface AdvancedSearchField {
  name: string;
  label: string;
  /** 表单项类型，默认 text */
  type?: 'text' | 'number' | 'date';
}

export interface AdvancedSearchConfig {
  /** 菜单项文案，默认「高级搜索」 */
  label?: string;
  /** 搜索表单字段配置，用于动态生成表单项 */
  fields: AdvancedSearchField[];
  /** 提交搜索条件后请求候选列表，返回 { value, label }[] */
  onSearch: (values: Record<string, any>) => Promise<Array<{ value: any; label: string }>>;
}

export interface UniDropdownOption {
  value: any;
  label: string;
}
