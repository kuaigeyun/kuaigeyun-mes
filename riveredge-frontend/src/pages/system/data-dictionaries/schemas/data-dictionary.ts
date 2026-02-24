/**
 * 数据字典表单 Schema
 */

import type { FieldConfig } from '../../../../components/schema-form';

export const dataDictionaryFormSchema: FieldConfig[] = [
  {
    name: 'name',
    type: 'text',
    labelKey: 'field.dataDictionary.name',
    placeholderKey: 'field.dataDictionary.namePlaceholder',
    required: true,
    rules: [{ required: true, messageKey: 'field.dataDictionary.nameRequired' }],
  },
  {
    name: 'code',
    type: 'text',
    labelKey: 'field.dataDictionary.code',
    placeholderKey: 'field.dataDictionary.codePlaceholder',
    required: true,
    rules: [{ required: true, messageKey: 'field.dataDictionary.codeRequired' }],
  },
  {
    name: 'description',
    type: 'textarea',
    labelKey: 'field.dataDictionary.description',
    placeholderKey: 'field.dataDictionary.descriptionPlaceholder',
  },
  {
    name: 'is_active',
    type: 'switch',
    labelKey: 'field.dataDictionary.isActive',
  },
];
