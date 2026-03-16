/**
 * 职位表单 Schema
 */

import type { FieldConfig } from '../../../../components/schema-form';

export const positionFormSchema: FieldConfig[] = [
  {
    name: 'code',
    type: 'text',
    labelKey: 'field.position.code',
    placeholderKey: 'field.position.codePlaceholder',
    required: true,
    rules: [{ required: true, messageKey: 'field.position.codeRequired' }],
  },
  {
    name: 'name',
    type: 'text',
    labelKey: 'field.position.name',
    placeholderKey: 'field.position.namePlaceholder',
    required: true,
    rules: [{ required: true, messageKey: 'field.position.nameRequired' }],
  },
  {
    name: 'department_uuid',
    type: 'treeSelect',
    labelKey: 'field.position.departmentUuid',
    placeholderKey: 'field.position.departmentUuidPlaceholder',
    allowClear: true,
  },
  {
    name: 'sort_order',
    type: 'number',
    labelKey: 'field.position.sortOrder',
  },
  {
    name: 'description',
    type: 'textarea',
    labelKey: 'field.position.remark',
    placeholderKey: 'field.position.remarkPlaceholder',
    colSpan: 24,
    fieldProps: { rows: 2 },
  },
  {
    name: 'is_active',
    type: 'switch',
    labelKey: 'field.position.isActive',
  },
];
