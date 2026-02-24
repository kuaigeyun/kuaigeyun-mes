/**
 * 部门表单 Schema
 */

import type { FieldConfig } from '../../../../components/schema-form';

export const departmentFormSchema: FieldConfig[] = [
  {
    name: 'name',
    type: 'text',
    labelKey: 'field.department.name',
    placeholderKey: 'field.department.namePlaceholder',
    required: true,
    rules: [{ required: true, messageKey: 'field.department.nameRequired' }],
  },
  {
    name: 'code',
    type: 'text',
    labelKey: 'field.department.code',
    placeholderKey: 'field.department.codePlaceholder',
    required: true,
    rules: [{ required: true, messageKey: 'field.department.codeRequired' }],
  },
  {
    name: 'parent_uuid',
    type: 'treeSelect',
    labelKey: 'field.department.parentUuid',
    placeholderKey: 'field.department.parentIdPlaceholder',
    allowClear: true,
  },
  {
    name: 'description',
    type: 'textarea',
    labelKey: 'field.department.description',
    placeholderKey: 'field.department.descriptionPlaceholder',
  },
  {
    name: 'sort_order',
    type: 'number',
    labelKey: 'field.department.sortOrder',
    colSpan: 12,
  },
  {
    name: 'is_active',
    type: 'switch',
    labelKey: 'field.department.isActive',
  },
];
