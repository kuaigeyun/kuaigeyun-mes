/**
 * 表单 Schema 类型定义（共享）
 *
 * 用于 schema 驱动表单，消除硬编号。
 * 供 master-data、system、infra 等模块复用。
 */

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'datetime'
  | 'switch'
  | 'select'
  | 'treeSelect'
  | 'radio'
  | 'segmented'
  | 'upload'
  | 'slot';

export interface RuleConfig {
  required?: boolean;
  max?: number;
  min?: number;
  maxLength?: number;
  type?: 'email' | 'number' | 'string';
  /** 正则校验 */
  pattern?: RegExp;
  messageKey?: string;
  message?: string;
}

export interface FieldConfig {
  name: string;
  type: FieldType;
  labelKey?: string;
  /** slot 类型时使用，对应 slots 的 key */
  slotKey?: string;
  placeholderKey?: string;
  required?: boolean;
  maxLength?: number;
  rules?: RuleConfig[];
  colSpan?: number;
  /** 扩展：select 的 options 来源（异步） */
  optionsApi?: () => Promise<Array<{ value: any; label: string }>>;
  /** 扩展：select 是否允许清空 */
  allowClear?: boolean;
  /** 扩展：select 多选模式 */
  mode?: 'multiple' | 'tags';
  /** 扩展：select 静态选项（labelKey 为 i18n key，渲染时翻译） */
  options?: Array<{ labelKey: string; value: any }>;
  /** 扩展：表单项下方说明文案的 i18n key */
  extraKey?: string;
  /** 扩展：当为 true 且 extraKey 存在时，将 extra 内容以 tooltip 形式显示在标题后的问号图标上，而非表单项下方 */
  extraAsTooltip?: boolean;
  /** 扩展：自定义组件类型 */
  component?: string;
  /** 扩展：fieldProps 透传 */
  fieldProps?: Record<string, any>;
  /** 编辑模式下禁用（如语言代码创建后不可改） */
  disabledWhenEdit?: boolean;
  /** 仅新建时展示（编辑弹窗隐藏） */
  createOnly?: boolean;
  /** 表单项初始值（如 switch 默认关） */
  initialValue?: unknown;
  /** 当指定字段等于某值时显示本字段 */
  visibleWhen?: { field: string; equals: unknown };
  /** slot=customFields 时：自定义字段半宽栏数（未设则从 schema 其它字段 colSpan 推断） */
  slotGridColumns?: 1 | 2 | 3 | 4;
}
