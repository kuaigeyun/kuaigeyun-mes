/**
 * 工作中心表单 Schema 配置
 */

import type { FieldConfig } from './form-schemas';

export const workCenterFormSchema: FieldConfig[] = [
  {
    name: 'code',
    type: 'text',
    labelKey: 'field.workCenter.code',
    placeholderKey: 'field.workCenter.codePlaceholder',
    required: true,
    colSpan: 12,
    rules: [
      { required: true, messageKey: 'field.workCenter.codeRequired' },
    ],
    fieldProps: { style: { textTransform: 'uppercase' } },
  },
  {
    name: 'name',
    type: 'text',
    labelKey: 'field.workCenter.name',
    required: true,
    colSpan: 12,
    rules: [{ required: true, messageKey: 'field.workCenter.nameRequired' }],
  },
  {
    name: 'description',
    type: 'textarea',
    labelKey: 'field.workCenter.description',
    colSpan: 24,
    fieldProps: { rows: 3 },
  },
  {
    name: 'workstationIds',
    type: 'select',
    labelKey: 'field.workCenter.workstationIds',
    placeholderKey: 'field.workCenter.workstationIdsPlaceholder',
    colSpan: 24,
    mode: 'multiple',
    fieldProps: { allowClear: true },
  },
  {
    name: 'isActive',
    type: 'switch',
    labelKey: 'field.workCenter.isActive',
    colSpan: 12,
  },
];
