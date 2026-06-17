/**
 * 部门表单 Schema
 */

import type { FieldConfig } from '../../../../components/schema-form';

export const departmentFormSchema: FieldConfig[] = [
  {
    name: 'code',
    type: 'text',
    labelKey: 'field.department.code',
    placeholderKey: 'field.department.codePlaceholder',
    required: true,
    rules: [{ required: true, messageKey: 'field.department.codeRequired' }],
  },
  {
    name: 'name',
    type: 'text',
    labelKey: 'field.department.name',
    placeholderKey: 'field.department.namePlaceholder',
    required: true,
    rules: [{ required: true, messageKey: 'field.department.nameRequired' }],
  },
  {
    name: 'parent_uuid',
    type: 'treeSelect',
    labelKey: 'field.department.parentUuid',
    placeholderKey: 'field.department.parentIdPlaceholder',
    allowClear: true,
  },
  {
    name: 'manager_uuid',
    type: 'slot',
    slotKey: 'manager_uuid',
    labelKey: 'field.department.managerUuid',
  },
  {
    name: 'sort_order',
    type: 'number',
    labelKey: 'field.department.sortOrder',
  },
  {
    name: 'description',
    type: 'textarea',
    labelKey: 'field.department.remark',
    placeholderKey: 'field.department.remarkPlaceholder',
    colSpan: 24,
    fieldProps: { rows: 2 },
  },
  {
    name: 'is_active',
    type: 'switch',
    labelKey: 'field.department.isActive',
  },
];
