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
    rules: [{ required: true, messageKey: 'field.role.nameRequired' }],
  },
  {
    name: 'description',
    type: 'textarea',
    labelKey: 'field.role.description',
    placeholderKey: 'field.role.descriptionPlaceholder',
  },
  {
    name: 'is_active',
    type: 'switch',
    labelKey: 'field.role.isActive',
  },
];
