/**
 * 客户表单 Schema 配置
 */

import type { FieldConfig } from './form-schemas';

export const customerFormSchema: FieldConfig[] = [
  {
    name: 'code',
    type: 'text',
    labelKey: 'field.customer.code',
    placeholderKey: 'field.customer.codePlaceholder',
    required: true,
    maxLength: 50,
    colSpan: 12,
    rules: [
      { required: true, messageKey: 'field.customer.codeRequired' },
      { maxLength: 50, messageKey: 'field.customer.codeMaxLength' },
    ],
    fieldProps: { style: { textTransform: 'uppercase' } },
  },
  {
    name: 'name',
    type: 'text',
    labelKey: 'field.customer.name',
    placeholderKey: 'field.customer.namePlaceholder',
    required: true,
    maxLength: 200,
    colSpan: 12,
    rules: [
      { required: true, messageKey: 'field.customer.nameRequired' },
      { maxLength: 200, messageKey: 'field.customer.nameMaxLength' },
    ],
  },
  {
    name: 'shortName',
    type: 'text',
    labelKey: 'field.customer.shortName',
    placeholderKey: 'field.customer.shortNamePlaceholder',
    maxLength: 100,
    colSpan: 12,
    rules: [{ maxLength: 100, messageKey: 'field.customer.shortNameMaxLength' }],
  },
  {
    name: 'contactPerson',
    type: 'text',
    labelKey: 'field.customer.contactPerson',
    placeholderKey: 'field.customer.contactPersonPlaceholder',
    maxLength: 100,
    colSpan: 12,
    rules: [{ maxLength: 100, messageKey: 'field.customer.contactPersonMaxLength' }],
  },
  {
    name: 'phone',
    type: 'text',
    labelKey: 'field.customer.phone',
    placeholderKey: 'field.customer.phonePlaceholder',
    maxLength: 20,
    colSpan: 12,
    rules: [{ maxLength: 20, messageKey: 'field.customer.phoneMaxLength' }],
  },
  {
    name: 'email',
    type: 'text',
    labelKey: 'field.customer.email',
    placeholderKey: 'field.customer.emailPlaceholder',
    maxLength: 100,
    colSpan: 12,
    rules: [
      { type: 'email', messageKey: 'field.customer.emailInvalid' },
      { maxLength: 100, messageKey: 'field.customer.emailMaxLength' },
    ],
  },
  {
    name: 'category',
    type: 'text',
    labelKey: 'field.customer.category',
    placeholderKey: 'field.customer.categoryPlaceholder',
    maxLength: 50,
    colSpan: 12,
    rules: [{ maxLength: 50, messageKey: 'field.customer.categoryMaxLength' }],
  },
  {
    name: 'address',
    type: 'textarea',
    labelKey: 'field.customer.address',
    placeholderKey: 'field.customer.addressPlaceholder',
    colSpan: 24,
    fieldProps: { rows: 3, maxLength: 500 },
  },
  {
    name: 'isActive',
    type: 'switch',
    labelKey: 'field.customer.isActive',
    colSpan: 12,
  },
];
