/**
 * 供应商表单 Schema：TAB1 基本信息、TAB2 开票资料、TAB3 业务与扩展
 */

import type { FieldConfig } from '../../../components/schema-form';
import { partnerInvoiceFormFields, partnerExtendedCommonFormFields } from './partner-form-shared';

/** TAB：基本信息 */
export const supplierFormSchemaBasic: FieldConfig[] = [
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
    name: 'category',
    type: 'select',
    labelKey: 'field.supplier.category',
    placeholderKey: 'field.supplier.categoryPlaceholder',
    colSpan: 12,
    allowClear: true,
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
    name: 'contactTitle',
    type: 'select',
    labelKey: 'field.supplier.contactTitle',
    placeholderKey: 'field.supplier.contactTitlePlaceholder',
    colSpan: 12,
    allowClear: true,
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
    name: 'buyerId',
    type: 'select',
    labelKey: 'field.supplier.buyer',
    placeholderKey: 'field.supplier.buyerPlaceholder',
    colSpan: 12,
    allowClear: true,
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

export const supplierFormSchemaInvoice: FieldConfig[] = partnerInvoiceFormFields;

const supplierBusinessFields: FieldConfig[] = [
  {
    name: 'payableRecognitionOverride',
    type: 'select',
    labelKey: 'field.supplier.payableRecognitionOverride',
    placeholderKey: 'field.partner.recognitionOverrideInherit',
    colSpan: 12,
    allowClear: true,
    extraKey: 'field.supplier.payableRecognitionOverrideDesc',
    extraAsTooltip: true,
    options: [
      { labelKey: 'field.partner.recognitionOverrideInherit', value: null },
      {
        labelKey: 'pages.system.configCenter.param.finance_payable_recognition_opt_on_receipt',
        value: 'on_receipt',
      },
      {
        labelKey: 'pages.system.configCenter.param.finance_payable_recognition_opt_on_purchase_invoice',
        value: 'on_purchase_invoice',
      },
    ],
  },
  {
    name: 'industryCode',
    type: 'select',
    labelKey: 'field.supplier.industry',
    placeholderKey: 'field.supplier.industryPlaceholder',
    colSpan: 12,
    allowClear: true,
  },
  {
    name: 'sourceChannelCode',
    type: 'select',
    labelKey: 'field.supplier.sourceChannel',
    placeholderKey: 'field.supplier.sourceChannelPlaceholder',
    colSpan: 12,
    allowClear: true,
  },
  {
    name: 'estimatedAnnualPurchase',
    type: 'number',
    labelKey: 'field.supplier.estimatedAnnualPurchase',
    placeholderKey: 'field.supplier.estimatedAnnualPurchasePlaceholder',
    colSpan: 12,
    fieldProps: { min: 0, precision: 2, style: { width: '100%' } },
  },
  {
    name: 'creditLimit',
    type: 'number',
    labelKey: 'field.supplier.creditLimit',
    placeholderKey: 'field.supplier.creditLimitPlaceholder',
    colSpan: 12,
    fieldProps: { min: 0, precision: 2, style: { width: '100%' } },
  },
];

export const supplierFormSchemaExtended: FieldConfig[] = [
  ...supplierBusinessFields,
  ...partnerExtendedCommonFormFields,
];
