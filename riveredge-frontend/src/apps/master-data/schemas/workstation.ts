/**
 * 工位表单 Schema 配置
 */

import type { FieldConfig } from './form-schemas';

export const workstationFormSchema: FieldConfig[] = [
  {
    name: 'code',
    type: 'text',
    labelKey: 'field.workstation.code',
    placeholderKey: 'field.workstation.codePlaceholder',
    required: true,
    colSpan: 12,
    rules: [
      { required: true, messageKey: 'field.workstation.codeRequired' },
    ],
    fieldProps: { style: { textTransform: 'uppercase' } },
  },
  {
    name: 'name',
    type: 'text',
    labelKey: 'field.workstation.name',
    required: true,
    colSpan: 12,
    rules: [{ required: true, messageKey: 'field.workstation.nameRequired' }],
  },
  {
    name: 'productionLineId',
    type: 'select',
    labelKey: 'field.workstation.productionLineId',
    placeholderKey: 'field.workstation.productionLineIdPlaceholder',
    required: true,
    colSpan: 12,
    rules: [{ required: true, messageKey: 'field.workstation.productionLineIdRequired' }],
  },
  {
    name: 'description',
    type: 'textarea',
    labelKey: 'field.workstation.description',
    colSpan: 24,
    fieldProps: { rows: 4, maxLength: 1000 },
  },
  {
    name: 'isActive',
    type: 'switch',
    labelKey: 'field.workstation.isActive',
    colSpan: 12,
  },
];
