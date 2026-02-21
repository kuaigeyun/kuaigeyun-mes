/**
 * UniDropdown 组件类型定义
 *
 * 管理型下拉（客户、物料等）的「快速新建」「高级搜索」配置类型。
 */

export interface QuickCreateConfig {
  /** 菜单项文案，默认「快速新建」 */
  label?: string;
  /** 点击时触发，由父组件打开新建弹窗等 */
  onClick: () => void;
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
