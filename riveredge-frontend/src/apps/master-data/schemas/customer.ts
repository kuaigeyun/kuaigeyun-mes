/**
 * 客户表单 Schema：TAB1 基本信息、TAB2 开票资料、TAB3 业务与扩展
 */

import type { FieldConfig } from '../../../components/schema-form';
import { partnerInvoiceFormFields, partnerExtendedFormFieldsWithoutFinance } from './partner-form-shared';

/** TAB：基本信息（联系人明细表插在 head 与 tail 之间） */
export const customerFormSchemaBasicHead: FieldConfig[] = [
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
];

export const customerFormSchemaBasicTail: FieldConfig[] = [
  {
    name: 'salesmanId',
    type: 'select',
    labelKey: 'field.customer.salesman',
    placeholderKey: 'field.customer.salesmanPlaceholder',
    colSpan: 12,
    allowClear: true,
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
    fieldProps: { className: 'form-field-segmented', size: 'middle' },
    rules: [{ required: true, messageKey: 'field.customer.visibilityRequired' }],
  },
  {
    name: 'isActive',
    type: 'switch',
    labelKey: 'field.customer.isActive',
    colSpan: 12,
  },
];

/** 编辑与新建共用尾部字段 */
export const customerFormSchemaBasicTailEdit: FieldConfig[] = customerFormSchemaBasicTail;

/** @deprecated 使用 head + 联系人明细 + tail */
export const customerFormSchemaBasic: FieldConfig[] = [
  ...customerFormSchemaBasicHead,
  ...customerFormSchemaBasicTail,
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

/** TAB：业务与扩展（客户业务指标 + 商事/结算/收货联系人） */
export const customerFormSchemaExtended: FieldConfig[] = [
  ...customerBusinessFields,
  ...partnerExtendedFormFieldsWithoutFinance,
];
