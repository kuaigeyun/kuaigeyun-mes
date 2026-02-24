/**
 * 职位表单 Schema
 */

import type { FieldConfig } from '../../../../components/schema-form';

export const positionFormSchema: FieldConfig[] = [
  {
    name: 'name',
    type: 'text',
    labelKey: 'field.position.name',
    placeholderKey: 'field.position.namePlaceholder',
    required: true,
    rules: [{ required: true, messageKey: 'field.position.nameRequired' }],
  },
  {
    name: 'code',
    type: 'text',
    labelKey: 'field.position.code',
    placeholderKey: 'field.position.codePlaceholder',
  },
  {
    name: 'department_uuid',
    type: 'treeSelect',
    labelKey: 'field.position.departmentUuid',
    placeholderKey: 'field.position.departmentUuidPlaceholder',
    allowClear: true,
  },
  {
    name: 'description',
    type: 'textarea',
    labelKey: 'field.position.description',
    placeholderKey: 'field.position.descriptionPlaceholder',
  },
  {
    name: 'sort_order',
    type: 'number',
    labelKey: 'field.position.sortOrder',
    colSpan: 12,
  },
  {
    name: 'is_active',
    type: 'switch',
    labelKey: 'field.position.isActive',
  },
];
