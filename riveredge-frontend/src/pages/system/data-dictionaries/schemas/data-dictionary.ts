/**
 * 数据字典表单 Schema
 */

import type { FieldConfig } from '../../../../components/schema-form';

export const dataDictionaryFormSchema: FieldConfig[] = [
  {
    name: 'code',
    type: 'text',
    labelKey: 'field.dataDictionary.code',
    placeholderKey: 'field.dataDictionary.codePlaceholder',
    required: true,
    rules: [{ required: true, messageKey: 'field.dataDictionary.codeRequired' }],
  },
  {
    name: 'name',
    type: 'text',
    labelKey: 'field.dataDictionary.name',
    placeholderKey: 'field.dataDictionary.namePlaceholder',
    required: true,
    rules: [{ required: true, messageKey: 'field.dataDictionary.nameRequired' }],
  },
  {
    name: 'description',
    type: 'textarea',
    labelKey: 'field.dataDictionary.remark',
    placeholderKey: 'field.dataDictionary.remarkPlaceholder',
    colSpan: 24,
    fieldProps: { rows: 2 },
  },
  {
    name: 'is_active',
    type: 'switch',
    labelKey: 'field.dataDictionary.isActive',
  },
];
