/**
 * 序列号规则常量
 *
 * 序列号规则场景下的上下文变量（form_field 等价物），
 * 用于 CodeRuleComponentBuilder 的 availableFields。
 */

import type { CodeRuleComponent } from '../../../types/codeRuleComponent';
import {
  createDefaultFixedTextComponent,
  createDefaultAutoCounterComponent,
} from '../../../types/codeRuleComponent';

export const SERIAL_RULE_AVAILABLE_FIELDS = [
  { field_name: 'material_code', field_label: '物料编号', field_type: 'string' },
  { field_name: 'group_code', field_label: '物料分组编号', field_type: 'string' },
  { field_name: 'product_code', field_label: '产品编号', field_type: 'string' },
] as const;

/** 新建序列号规则时的默认组件：固定字符(SN-) + 自动计数(8位) */
export const DEFAULT_SERIAL_RULE_COMPONENTS: CodeRuleComponent[] = [
  { ...createDefaultFixedTextComponent(0), text: 'SN-' },
  createDefaultAutoCounterComponent(1, 8, 'never'),
];
