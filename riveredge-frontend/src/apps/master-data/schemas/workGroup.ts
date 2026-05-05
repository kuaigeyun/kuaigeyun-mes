/**
 * 工作小组表单 Schema 配置
 *
 * 拆分为 basic（编号、名称）和 rest（备注、启用状态），
 * 中间插入成员列表区块，顺序为：basic -> 成员 -> rest
 */

import type { FieldConfig } from './form-schemas';

/** 基础字段：编号、名称（成员列表之前） */
export const workGroupFormSchemaBasic: FieldConfig[] = [
  {
    name: 'code',
    type: 'text',
    labelKey: 'field.workGroup.code',
    placeholderKey: 'field.workGroup.codePlaceholder',
    required: true,
    colSpan: 12,
    rules: [{ required: true, messageKey: 'field.workGroup.codeRequired' }],
    fieldProps: { style: { textTransform: 'uppercase' } },
  },
  {
    name: 'name',
    type: 'text',
    labelKey: 'field.workGroup.name',
    required: true,
    colSpan: 12,
    rules: [{ required: true, messageKey: 'field.workGroup.nameRequired' }],
  },
];

/** 备注及之后字段（成员列表之后） */
export const workGroupFormSchemaRest: FieldConfig[] = [
  { type: 'slot', name: '__customFields__', slotKey: 'customFields' },
  {
    name: 'description',
    type: 'textarea',
    labelKey: 'field.workGroup.description',
    colSpan: 24,
    fieldProps: { rows: 2 },
  },
  {
    name: 'isActive',
    type: 'switch',
    labelKey: 'field.workGroup.isActive',
    colSpan: 12,
  },
];

/** 完整 schema（兼容旧用法） */
export const workGroupFormSchema: FieldConfig[] = [
  ...workGroupFormSchemaBasic,
  ...workGroupFormSchemaRest,
];
