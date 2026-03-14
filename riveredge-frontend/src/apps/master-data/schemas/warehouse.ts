/**
 * 仓库表单 Schema 配置
 */

import type { FieldConfig } from './form-schemas';

export const WAREHOUSE_TYPE_OPTIONS = [
  { labelKey: 'warehouse.type.normal', value: 'normal' },
  { labelKey: 'warehouse.type.line_side', value: 'line_side' },
  { labelKey: 'warehouse.type.wip', value: 'wip' },
  { labelKey: 'warehouse.type.outsourcing', value: 'outsourcing' },
  { labelKey: 'warehouse.type.consignment', value: 'consignment' },
  { labelKey: 'warehouse.type.vmi', value: 'vmi' },
  { labelKey: 'warehouse.type.defect', value: 'defect' },
  { labelKey: 'warehouse.type.quarantine', value: 'quarantine' },
];

export const warehouseFormSchema: FieldConfig[] = [
  {
    name: 'code',
    type: 'text',
    labelKey: 'field.warehouse.code',
    placeholderKey: 'field.warehouse.codePlaceholder',
    required: true,
    colSpan: 12,
    rules: [
      { required: true, messageKey: 'field.warehouse.codeRequired' },
    ],
    fieldProps: { style: { textTransform: 'uppercase' } },
  },
  {
    name: 'name',
    type: 'text',
    labelKey: 'field.warehouse.name',
    required: true,
    colSpan: 12,
    rules: [{ required: true, messageKey: 'field.warehouse.nameRequired' }],
  },
  {
    name: 'warehouseType',
    type: 'select',
    labelKey: 'field.warehouse.warehouseType',
    placeholderKey: 'field.warehouse.warehouseTypePlaceholder',
    colSpan: 12,
    options: WAREHOUSE_TYPE_OPTIONS,
  },
  {
    name: 'description',
    type: 'textarea',
    labelKey: 'field.warehouse.description',
    colSpan: 24,
    fieldProps: { rows: 3 },
  },
  {
    name: 'isActive',
    type: 'switch',
    labelKey: 'field.warehouse.isActive',
    colSpan: 12,
  },
];
