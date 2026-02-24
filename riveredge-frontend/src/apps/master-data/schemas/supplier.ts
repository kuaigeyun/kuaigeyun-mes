/**
 * 供应商表单 Schema 配置
 */

import type { FieldConfig } from './form-schemas';

export const supplierFormSchema: FieldConfig[] = [
  {
    name: 'code',
    type: 'text',
    labelKey: 'field.supplier.code',
    placeholderKey: 'field.supplier.codePlaceholder',
    required: true,
    maxLength: 50,
    colSpan: 12,
    rules: [
      { required: true, messageKey: 'field.supplier.codeRequired' },
      { maxLength: 50, messageKey: 'field.supplier.codeMaxLength' },
    ],
    fieldProps: { style: { textTransform: 'uppercase' } },
  },
  {
    name: 'name',
    type: 'text',
    labelKey: 'field.supplier.name',
    placeholderKey: 'field.supplier.namePlaceholder',
    required: true,
    maxLength: 200,
    colSpan: 12,
    rules: [
      { required: true, messageKey: 'field.supplier.nameRequired' },
      { maxLength: 200, messageKey: 'field.supplier.nameMaxLength' },
    ],
  },
  {
    name: 'shortName',
    type: 'text',
    labelKey: 'field.supplier.shortName',
    placeholderKey: 'field.supplier.shortNamePlaceholder',
    maxLength: 100,
    colSpan: 12,
    rules: [{ maxLength: 100, messageKey: 'field.supplier.shortNameMaxLength' }],
  },
  {
    name: 'contactPerson',
    type: 'text',
    labelKey: 'field.supplier.contactPerson',
    placeholderKey: 'field.supplier.contactPersonPlaceholder',
    maxLength: 100,
    colSpan: 12,
    rules: [{ maxLength: 100, messageKey: 'field.supplier.contactPersonMaxLength' }],
  },
  {
    name: 'phone',
    type: 'text',
    labelKey: 'field.supplier.phone',
    placeholderKey: 'field.supplier.phonePlaceholder',
    maxLength: 20,
    colSpan: 12,
    rules: [{ maxLength: 20, messageKey: 'field.supplier.phoneMaxLength' }],
  },
  {
    name: 'email',
    type: 'text',
    labelKey: 'field.supplier.email',
    placeholderKey: 'field.supplier.emailPlaceholder',
    maxLength: 100,
    colSpan: 12,
    rules: [
      { type: 'email', messageKey: 'field.supplier.emailInvalid' },
      { maxLength: 100, messageKey: 'field.supplier.emailMaxLength' },
    ],
  },
  {
    name: 'category',
    type: 'text',
    labelKey: 'field.supplier.category',
    placeholderKey: 'field.supplier.categoryPlaceholder',
    maxLength: 50,
    colSpan: 12,
    rules: [{ maxLength: 50, messageKey: 'field.supplier.categoryMaxLength' }],
  },
  {
    name: 'address',
    type: 'textarea',
    labelKey: 'field.supplier.address',
    placeholderKey: 'field.supplier.addressPlaceholder',
    colSpan: 24,
    fieldProps: { rows: 3, maxLength: 500 },
  },
  {
    name: 'isActive',
    type: 'switch',
    labelKey: 'field.supplier.isActive',
    colSpan: 12,
  },
];
