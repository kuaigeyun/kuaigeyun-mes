/**
 * 客户表单 Schema：TAB1 基本信息、TAB2 开票资料、TAB3 业务与扩展
 */

import type { FieldConfig } from '../../../components/schema-form';
import { partnerInvoiceFormFields, partnerExtendedCommonFormFields } from './partner-form-shared';

/** TAB：基本信息 */
export const customerFormSchemaBasic: FieldConfig[] = [
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
    name: 'category',
    type: 'select',
    labelKey: 'field.customer.category',
    placeholderKey: 'field.customer.categoryPlaceholder',
    colSpan: 12,
    allowClear: true,
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
    name: 'contactTitle',
    type: 'select',
    labelKey: 'field.customer.contactTitle',
    placeholderKey: 'field.customer.contactTitlePlaceholder',
    colSpan: 12,
    allowClear: true,
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
    name: 'salesmanId',
    type: 'select',
    labelKey: 'field.customer.salesman',
    placeholderKey: 'field.customer.salesmanPlaceholder',
    colSpan: 12,
    allowClear: true,
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
    name: 'isPublic',
    type: 'segmented',
    labelKey: 'field.customer.visibility',
    colSpan: 12,
    required: true,
    options: [
      { labelKey: 'field.customer.visibilityPrivate', value: false },
      { labelKey: 'field.customer.visibilityPublic', value: true },
    ],
    rules: [{ required: true, messageKey: 'field.customer.visibilityRequired' }],
  },
  {
    name: 'isActive',
    type: 'switch',
    labelKey: 'field.customer.isActive',
    colSpan: 12,
  },
];

/** TAB：开票资料（与客户/供应商共用字段） */
export const customerFormSchemaInvoice: FieldConfig[] = partnerInvoiceFormFields;

const customerBusinessFields: FieldConfig[] = [
  {
    name: 'revenueRecognitionOverride',
    type: 'select',
    labelKey: 'field.customer.revenueRecognitionOverride',
    placeholderKey: 'field.partner.recognitionOverrideInherit',
    colSpan: 12,
    allowClear: true,
    extraKey: 'field.customer.revenueRecognitionOverrideDesc',
    extraAsTooltip: true,
    options: [
      { labelKey: 'field.partner.recognitionOverrideInherit', value: null },
      {
        labelKey: 'pages.system.configCenter.param.finance_revenue_recognition_opt_on_shipment',
        value: 'on_shipment',
      },
      {
        labelKey: 'pages.system.configCenter.param.finance_revenue_recognition_opt_on_invoice',
        value: 'on_invoice',
      },
    ],
  },
  {
    name: 'industryCode',
    type: 'select',
    labelKey: 'field.customer.industry',
    placeholderKey: 'field.customer.industryPlaceholder',
    colSpan: 12,
    allowClear: true,
  },
  {
    name: 'customerLevelCode',
    type: 'select',
    labelKey: 'field.customer.level',
    placeholderKey: 'field.customer.levelPlaceholder',
    colSpan: 12,
    allowClear: true,
  },
  {
    name: 'leadSourceCode',
    type: 'select',
    labelKey: 'field.customer.leadSource',
    placeholderKey: 'field.customer.leadSourcePlaceholder',
    colSpan: 12,
    allowClear: true,
  },
  {
    name: 'estimatedAnnualPurchase',
    type: 'number',
    labelKey: 'field.customer.estimatedAnnualPurchase',
    placeholderKey: 'field.customer.estimatedAnnualPurchasePlaceholder',
    colSpan: 12,
    fieldProps: { min: 0, precision: 2, style: { width: '100%' } },
  },
  {
    name: 'creditLimit',
    type: 'number',
    labelKey: 'field.customer.creditLimit',
    placeholderKey: 'field.customer.creditLimitPlaceholder',
    colSpan: 12,
    fieldProps: { min: 0, precision: 2, style: { width: '100%' } },
  },
];

/** TAB：业务与扩展（客户业务指标 + 商事/结算/联系人） */
export const customerFormSchemaExtended: FieldConfig[] = [
  ...customerBusinessFields,
  ...partnerExtendedCommonFormFields,
];
