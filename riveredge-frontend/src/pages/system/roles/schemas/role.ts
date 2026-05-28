/**
 * 角色表单 Schema
 * 注意：角色代码必须在角色名称之前（产品要求）
 */

import type { FieldConfig } from '../../../../components/schema-form';

export const roleFormSchema: FieldConfig[] = [
  {
    name: 'code',
    type: 'text',
    labelKey: 'field.role.code',
    placeholderKey: 'field.role.codePlaceholder',
    required: true,
    colSpan: 12,
    rules: [
      { required: true, messageKey: 'field.role.codeRequired' },
      { pattern: /^[a-zA-Z0-9_]+$/, messageKey: 'field.role.codePattern' },
    ],
  },
  {
    name: 'name',
    type: 'text',
    labelKey: 'field.role.name',
    placeholderKey: 'field.role.namePlaceholder',
    required: true,
    colSpan: 12,
    rules: [{ required: true, messageKey: 'field.role.nameRequired' }],
  },
  {
    name: 'role_type',
    type: 'select',
    labelKey: 'field.role.roleType',
    required: true,
    colSpan: 24,
    options: [
      { labelKey: 'field.role.roleTypeInternal', value: 'internal' },
      { labelKey: 'field.role.roleTypeExternal', value: 'external' },
    ],
  },
  {
    name: 'external_partner_type',
    type: 'select',
    labelKey: 'field.role.externalPartnerType',
    placeholderKey: 'field.role.externalPartnerTypePlaceholder',
    colSpan: 24,
    options: [
      { labelKey: 'field.role.externalPartnerCustomer', value: 'customer' },
      { labelKey: 'field.role.externalPartnerSupplier', value: 'supplier' },
    ],
    extraKey: 'field.role.externalPartnerTypeExtra',
    visibleWhen: { field: 'role_type', equals: 'external' },
  },
  {
    name: 'create_position',
    type: 'switch',
    labelKey: 'field.role.createPosition',
    extraKey: 'field.role.createPositionExtra',
    colSpan: 24,
    createOnly: true,
    initialValue: false,
  },
  {
    name: '_home_path_slot',
    type: 'slot',
    slotKey: 'homePath',
  },
  {
    name: 'description',
    type: 'textarea',
    labelKey: 'field.role.description',
    placeholderKey: 'field.role.descriptionPlaceholder',
    colSpan: 24,
    fieldProps: { rows: 2 },
  },
  {
    name: 'is_active',
    type: 'switch',
    labelKey: 'field.role.isActive',
    colSpan: 24,
  },
];
