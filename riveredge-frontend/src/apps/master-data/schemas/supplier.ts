/**
 * 供应商表单 Schema：TAB1 基本信息、TAB2 开票资料、TAB3 业务与扩展
 */

import type { FieldConfig } from '../../../components/schema-form';
import { partnerInvoiceFormFields, partnerExtendedFormFieldsWithoutFinance } from './partner-form-shared';

/** TAB：基本信息（联系人明细表插在 head 与 tail 之间） */
export const supplierFormSchemaBasicHead: FieldConfig[] = [
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
];

export const supplierFormSchemaBasicTail: FieldConfig[] = [
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

/** @deprecated 使用 head + 联系人明细 + tail */
export const supplierFormSchemaBasic: FieldConfig[] = [
  ...supplierFormSchemaBasicHead,
  ...supplierFormSchemaBasicTail,
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

/** TAB：业务与扩展（供应商业务指标 + 商事/结算/收货联系人） */
export const supplierFormSchemaExtended: FieldConfig[] = [
  ...supplierBusinessFields,
  ...partnerExtendedFormFieldsWithoutFinance,
];
