/**
 * 仓库表单 Schema 配置
 *
 * 线边仓时：关联车间、关联工位、关联工作中心 置于备注之前
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

/** 基础字段：编号、名称、仓库类型（线边仓关联字段之前） */
export const warehouseFormSchemaBasic: FieldConfig[] = [
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
];

/** 备注及之后字段（线边仓关联字段之后） */
export const warehouseFormSchemaRest: FieldConfig[] = [
  { type: 'slot', name: '__customFields__', slotKey: 'customFields', colSpan: 24 },
  {
    name: 'description',
    type: 'textarea',
    labelKey: 'field.warehouse.description',
    colSpan: 24,
    fieldProps: { rows: 2 },
  },
  {
    name: 'isActive',
    type: 'switch',
    labelKey: 'field.warehouse.isActive',
    colSpan: 12,
  },
];

/** 完整 schema（兼容旧用法） */
export const warehouseFormSchema: FieldConfig[] = [
  ...warehouseFormSchemaBasic,
  ...warehouseFormSchemaRest,
];
