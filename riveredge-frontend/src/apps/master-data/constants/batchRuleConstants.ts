/**
 * 批号规则常量
 *
 * 批号规则场景下的上下文变量（form_field 等价物），
 * 用于 CodeRuleComponentBuilder 的 availableFields。
 */

import type { CodeRuleComponent } from '../../../types/codeRuleComponent';
import {
  createDefaultDateComponent,
  createDefaultFixedTextComponent,
  createDefaultAutoCounterComponent,
} from '../../../types/codeRuleComponent';

export const BATCH_RULE_AVAILABLE_FIELDS = [
  { field_name: 'material_code', field_label: '物料编号', field_type: 'string' },
  { field_name: 'group_code', field_label: '物料分组编号', field_type: 'string' },
  { field_name: 'supplier_code', field_label: '供应商编号', field_type: 'string' },
] as const;

/** 新建批号规则时的默认组件：日期(YYYYMMDD) + 固定字符(-) + 自动计数(3位) */
export const DEFAULT_BATCH_RULE_COMPONENTS: CodeRuleComponent[] = [
  createDefaultDateComponent(0, 'YYYYMMDD'),
  { ...createDefaultFixedTextComponent(1), text: '-' },
  createDefaultAutoCounterComponent(2, 3, 'daily'),
];
