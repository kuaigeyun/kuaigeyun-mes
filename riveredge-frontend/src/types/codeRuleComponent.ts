/**
 * 编码规则组件类型定义
 * 
 * 参考简道云流水号规则设计，支持完全可配置的规则组件
 */

/**
 * 规则组件类型
 */
export type CodeRuleComponentType = 'auto_counter' | 'date' | 'fixed_text' | 'form_field';

/**
 * 自动计数组件配置
 * 必选组件，不可重复添加
 */
export interface AutoCounterComponent {
  type: 'auto_counter';
  order: number;
  digits: number; // 计数位数（2-12）
  fixed_width: boolean; // 是否固定位数
  reset_cycle: 'never' | 'daily' | 'monthly' | 'yearly'; // 重置周期
  initial_value: number; // 初始值
}

/**
 * 日期组件配置
 * 可选组件，不可重复添加
 */
export interface DateComponent {
  type: 'date';
  order: number;
  format_type: 'preset' | 'custom'; // 格式类型
  preset_format?: string; // 预定义格式（如：YYYYMMDD）
  custom_format?: string; // 自定义格式（使用y、M、d表示年月日）
}

/**
 * 固定字符组件配置
 * 可选组件，可重复添加
 */
export interface FixedTextComponent {
  type: 'fixed_text';
  order: number;
  text: string; // 固定字符内容
}

/**
 * 表单字段组件配置
 * 可选组件，可重复添加
 */
export interface FormFieldComponent {
  type: 'form_field';
  order: number;
  field_name: string; // 表单字段名称
}

/**
 * 规则组件联合类型
 */
export type CodeRuleComponent = 
  | AutoCounterComponent 
  | DateComponent 
  | FixedTextComponent 
  | FormFieldComponent;

/**
 * 规则组件配置
 */
export interface CodeRuleComponentsConfig {
  components: CodeRuleComponent[];
}

/**
 * 规则组件显示信息
 */
export interface CodeRuleComponentDisplayInfo {
  type: CodeRuleComponentType;
  label: string;
  description: string;
  icon?: string;
  required: boolean; // 是否必选
  repeatable: boolean; // 是否可重复添加
}

/**
 * 规则组件显示信息映射
 */
export const CODE_RULE_COMPONENT_DISPLAY_INFO: Record<CodeRuleComponentType, CodeRuleComponentDisplayInfo> = {
  auto_counter: {
    type: 'auto_counter',
    label: '自动计数',
    description: '自动递增的数字部分',
    required: true,
    repeatable: false,
  },
  date: {
    type: 'date',
    label: '提交日期',
    description: '数据的提交日期',
    required: false,
    repeatable: false,
  },
  fixed_text: {
    type: 'fixed_text',
    label: '固定字符',
    description: '固定的文本或字符',
    required: false,
    repeatable: true,
  },
  form_field: {
    type: 'form_field',
    label: '表单字段',
    description: '表单字段的值',
    required: false,
    repeatable: true,
  },
};

/**
 * 日期预定义格式选项
 */
export const DATE_PRESET_FORMATS = [
  { label: 'YYYYMMDD (20250120)', value: 'YYYYMMDD' },
  { label: 'YYYYMM (202501)', value: 'YYYYMM' },
  { label: 'YYYY (2025)', value: 'YYYY' },
  { label: 'YYMMDD (250120)', value: 'YYMMDD' },
  { label: 'YYMM (2501)', value: 'YYMM' },
  { label: 'YY (25)', value: 'YY' },
];

/**
 * 创建默认的自动计数组件
 */
export function createDefaultAutoCounterComponent(
  order: number = 0,
  digits: number = 5,
  resetCycle: 'never' | 'daily' | 'monthly' | 'yearly' = 'never'
): AutoCounterComponent {
  return {
    type: 'auto_counter',
    order,
    digits,
    fixed_width: true,
    reset_cycle: resetCycle,
    initial_value: 1,
  };
}

/**
 * 创建默认的日期组件
 */
export function createDefaultDateComponent(
  order: number = 0,
  presetFormat: string = 'YYYYMMDD'
): DateComponent {
  return {
    type: 'date',
    order,
    format_type: 'preset',
    preset_format: presetFormat,
  };
}

/**
 * 创建默认的固定字符组件
 */
export function createDefaultFixedTextComponent(order: number = 0): FixedTextComponent {
  return {
    type: 'fixed_text',
    order,
    text: '',
  };
}

/**
 * 创建默认的表单字段组件
 */
export function createDefaultFormFieldComponent(order: number = 0): FormFieldComponent {
  return {
    type: 'form_field',
    order,
    field_name: '',
  };
}

/**
 * 获取组件显示文本
 */
export function getComponentDisplayText(component: CodeRuleComponent): string {
  const info = CODE_RULE_COMPONENT_DISPLAY_INFO[component.type];
  
  switch (component.type) {
    case 'auto_counter':
      return `${info.label} ${component.digits}位数字, ${component.reset_cycle === 'never' ? '不自动重置' : `每${component.reset_cycle === 'daily' ? '日' : component.reset_cycle === 'monthly' ? '月' : '年'}重置`}`;
    case 'date':
      if (component.format_type === 'preset') {
        return `${info.label} 格式: ${component.preset_format || 'YYYYMMDD'}`;
      } else {
        return `${info.label} 格式: ${component.custom_format || 'yMd'}`;
      }
    case 'fixed_text':
      return `${info.label} ${component.text || '请输入内容'}`;
    case 'form_field':
      return `${info.label} ${component.field_name || '请选择字段'}`;
    default:
      return info.label;
  }
}
