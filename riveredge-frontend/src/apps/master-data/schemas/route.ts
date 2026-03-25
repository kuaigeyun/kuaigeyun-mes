/**
 * 工艺路线表单 Schema 配置（基础字段，工序序列由 OperationSequenceEditor 单独渲染）
 */

import type { FieldConfig } from './form-schemas';

export const routeFormSchema: FieldConfig[] = [
  {
    name: 'code',
    type: 'text',
    labelKey: 'field.route.code',
    placeholderKey: 'field.route.codePlaceholder',
    required: true,
    colSpan: 12,
    rules: [{ required: true, messageKey: 'field.route.codeRequired' }],
    fieldProps: { style: { textTransform: 'uppercase' } },
  },
  {
    name: 'name',
    type: 'text',
    labelKey: 'field.route.name',
    placeholderKey: 'field.route.namePlaceholder',
    required: true,
    colSpan: 12,
    rules: [{ required: true, messageKey: 'field.route.nameRequired' }],
  },
  {
    name: 'allowOperationJump',
    type: 'switch',
    labelKey: 'field.route.allowOperationJump',
    extraKey: 'field.route.allowOperationJumpExtra',
    extraAsTooltip: true,
    colSpan: 8,
  },
  {
    name: 'overReportMode',
    type: 'select',
    labelKey: 'field.route.overReportMode',
    colSpan: 8,
    options: [
      { labelKey: 'field.operation.overReportModeNone', value: 'none' },
      { labelKey: 'field.operation.overReportModeFixed', value: 'fixed' },
      { labelKey: 'field.operation.overReportModePercent', value: 'percent' },
    ],
  },
  {
    name: 'overReportValue',
    type: 'number',
    labelKey: 'field.route.overReportValue',
    placeholderKey: 'field.operation.overReportValuePlaceholder',
    colSpan: 8,
    fieldProps: { min: 0, precision: 4, style: { width: '100%' } },
    extraKey: 'field.route.overReportValueExtra',
    extraAsTooltip: true,
  },
  {
    name: 'description',
    type: 'textarea',
    labelKey: 'field.route.description',
    colSpan: 24,
    fieldProps: { rows: 2, maxLength: 1000 },
  },
  {
    name: 'isActive',
    type: 'switch',
    labelKey: 'field.route.isActive',
    colSpan: 12,
  },
];
