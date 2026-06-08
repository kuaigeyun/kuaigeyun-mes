/**
 * 客户/供应商共用的表单字段：开票资料 + 商事/结算/联系人扩展
 */

import type { FieldConfig } from '../../../components/schema-form';

/** 纸质增值税发票已基本停开，选项对齐现行数字化电子发票（数电票） */
const invoiceTypeOptions: FieldConfig['options'] = [
  { labelKey: 'field.partner.invoiceType.digitalSpecial', value: 'digital_vat_special' },
  { labelKey: 'field.partner.invoiceType.digitalOrdinary', value: 'digital_vat_ordinary' },
];

const taxpayerTypeOptions: FieldConfig['options'] = [
  { labelKey: 'field.partner.taxpayerType.general', value: 'general' },
  { labelKey: 'field.partner.taxpayerType.smallScale', value: 'small_scale' },
  { labelKey: 'field.partner.taxpayerType.nonEnterprise', value: 'non_enterprise' },
];

const enterpriseTypeOptions: FieldConfig['options'] = [
  { labelKey: 'field.partner.enterpriseType.limitedLiability', value: 'limited_liability' },
  { labelKey: 'field.partner.enterpriseType.companyLimitedByShares', value: 'company_limited_by_shares' },
  { labelKey: 'field.partner.enterpriseType.soleProprietorship', value: 'sole_proprietorship' },
  { labelKey: 'field.partner.enterpriseType.partnership', value: 'partnership' },
  { labelKey: 'field.partner.enterpriseType.individualBusiness', value: 'individual_business' },
  { labelKey: 'field.partner.enterpriseType.other', value: 'other' },
];

const settlementMethodOptions: FieldConfig['options'] = [
  { labelKey: 'field.partner.settlementMethod.cash', value: 'cash' },
  { labelKey: 'field.partner.settlementMethod.bankTransfer', value: 'bank_transfer' },
  { labelKey: 'field.partner.settlementMethod.bankAcceptance', value: 'bank_acceptance' },
  { labelKey: 'field.partner.settlementMethod.commercialAcceptance', value: 'commercial_acceptance' },
  { labelKey: 'field.partner.settlementMethod.monthly', value: 'monthly' },
  { labelKey: 'field.partner.settlementMethod.prepaid', value: 'prepaid' },
  { labelKey: 'field.partner.settlementMethod.other', value: 'other' },
];

/** 开票资料 TAB（开票地址、电话分栏） */
export const partnerInvoiceFormFields: FieldConfig[] = [
  {
    name: 'taxRegistrationNo',
    type: 'text',
    labelKey: 'field.partner.taxRegistrationNo',
    placeholderKey: 'field.partner.taxRegistrationNoPlaceholder',
    maxLength: 50,
    colSpan: 12,
    rules: [{ maxLength: 50, messageKey: 'field.partner.taxRegistrationNoMaxLength' }],
    extraKey: 'field.partner.taxRegistrationNoExtra',
    extraAsTooltip: true,
  },
  {
    name: 'invoiceTitle',
    type: 'text',
    labelKey: 'field.partner.invoiceTitle',
    placeholderKey: 'field.partner.invoiceTitlePlaceholder',
    maxLength: 200,
    colSpan: 12,
    rules: [{ maxLength: 200, messageKey: 'field.partner.invoiceTitleMaxLength' }],
  },
  {
    name: 'invoiceAddress',
    type: 'textarea',
    labelKey: 'field.partner.invoiceAddress',
    placeholderKey: 'field.partner.invoiceAddressPlaceholder',
    colSpan: 24,
    fieldProps: { rows: 2, maxLength: 500 },
  },
  {
    name: 'invoicePhone',
    type: 'text',
    labelKey: 'field.partner.invoicePhone',
    placeholderKey: 'field.partner.invoicePhonePlaceholder',
    maxLength: 50,
    colSpan: 12,
    rules: [{ maxLength: 50, messageKey: 'field.partner.invoicePhoneMaxLength' }],
  },
  {
    name: 'invoiceBankName',
    type: 'text',
    labelKey: 'field.partner.invoiceBankName',
    placeholderKey: 'field.partner.invoiceBankNamePlaceholder',
    maxLength: 200,
    colSpan: 12,
    rules: [{ maxLength: 200, messageKey: 'field.partner.invoiceBankNameMaxLength' }],
  },
  {
    name: 'invoiceBankAccount',
    type: 'text',
    labelKey: 'field.partner.invoiceBankAccount',
    placeholderKey: 'field.partner.invoiceBankAccountPlaceholder',
    maxLength: 64,
    colSpan: 12,
    rules: [{ maxLength: 64, messageKey: 'field.partner.invoiceBankAccountMaxLength' }],
  },
  {
    name: 'invoiceTypeCode',
    type: 'select',
    labelKey: 'field.partner.invoiceType',
    placeholderKey: 'field.partner.invoiceTypePlaceholder',
    options: invoiceTypeOptions,
    allowClear: true,
    colSpan: 12,
  },
  {
    name: 'taxpayerTypeCode',
    type: 'select',
    labelKey: 'field.partner.taxpayerType',
    placeholderKey: 'field.partner.taxpayerTypePlaceholder',
    options: taxpayerTypeOptions,
    allowClear: true,
    colSpan: 12,
  },
];

const partnerExtendedSettlementFormFields: FieldConfig[] = [
  {
    name: 'legalRepresentative',
    type: 'text',
    labelKey: 'field.partner.legalRepresentative',
    placeholderKey: 'field.partner.legalRepresentativePlaceholder',
    maxLength: 100,
    colSpan: 12,
    rules: [{ maxLength: 100, messageKey: 'field.partner.legalRepresentativeMaxLength' }],
  },
  {
    name: 'enterpriseTypeCode',
    type: 'select',
    labelKey: 'field.partner.enterpriseType',
    placeholderKey: 'field.partner.enterpriseTypePlaceholder',
    options: enterpriseTypeOptions,
    allowClear: true,
    colSpan: 12,
  },
  {
    name: 'paymentTermsDays',
    type: 'number',
    labelKey: 'field.partner.paymentTermsDays',
    placeholderKey: 'field.partner.paymentTermsDaysPlaceholder',
    colSpan: 12,
    fieldProps: { min: 0, precision: 0, style: { width: '100%' } },
  },
  {
    name: 'settlementMethodCode',
    type: 'select',
    labelKey: 'field.partner.settlementMethod',
    placeholderKey: 'field.partner.settlementMethodPlaceholder',
    options: settlementMethodOptions,
    allowClear: true,
    colSpan: 12,
  },
];

/** 财务联系人（客户已用联系人明细表，供应商仍保留） */
export const partnerFinanceContactFormFields: FieldConfig[] = [
  {
    name: 'financeContactName',
    type: 'text',
    labelKey: 'field.partner.financeContactName',
    placeholderKey: 'field.partner.financeContactNamePlaceholder',
    maxLength: 100,
    colSpan: 12,
    rules: [{ maxLength: 100, messageKey: 'field.partner.financeContactNameMaxLength' }],
  },
  {
    name: 'financeContactPhone',
    type: 'text',
    labelKey: 'field.partner.financeContactPhone',
    placeholderKey: 'field.partner.financeContactPhonePlaceholder',
    maxLength: 30,
    colSpan: 12,
    rules: [{ maxLength: 30, messageKey: 'field.partner.financeContactPhoneMaxLength' }],
  },
  {
    name: 'financeContactEmail',
    type: 'text',
    labelKey: 'field.partner.financeContactEmail',
    placeholderKey: 'field.partner.financeContactEmailPlaceholder',
    maxLength: 100,
    colSpan: 12,
    rules: [
      { type: 'email', messageKey: 'field.partner.financeContactEmailInvalid' },
      { maxLength: 100, messageKey: 'field.partner.financeContactEmailMaxLength' },
    ],
  },
];

const partnerDeliveryContactFormFields: FieldConfig[] = [
  {
    name: 'deliveryContactName',
    type: 'text',
    labelKey: 'field.partner.deliveryContactName',
    placeholderKey: 'field.partner.deliveryContactNamePlaceholder',
    maxLength: 100,
    colSpan: 12,
    rules: [{ maxLength: 100, messageKey: 'field.partner.deliveryContactNameMaxLength' }],
  },
  {
    name: 'deliveryContactPhone',
    type: 'text',
    labelKey: 'field.partner.deliveryContactPhone',
    placeholderKey: 'field.partner.deliveryContactPhonePlaceholder',
    maxLength: 30,
    colSpan: 12,
    rules: [{ maxLength: 30, messageKey: 'field.partner.deliveryContactPhoneMaxLength' }],
  },
  {
    name: 'deliveryAddress',
    type: 'textarea',
    labelKey: 'field.partner.deliveryAddress',
    placeholderKey: 'field.partner.deliveryAddressPlaceholder',
    colSpan: 24,
    fieldProps: { rows: 2, maxLength: 500 },
  },
];

/** 扩展 TAB：商事主体、结算、财务/收货联系人（业务指标在各自主 schema 中前置） */
export const partnerExtendedCommonFormFields: FieldConfig[] = [
  ...partnerExtendedSettlementFormFields,
  ...partnerFinanceContactFormFields,
  ...partnerDeliveryContactFormFields,
];

/** 客户扩展 TAB：不含财务联系人（基本信息 TAB 已有联系人明细表） */
export const partnerExtendedFormFieldsWithoutFinance: FieldConfig[] = [
  ...partnerExtendedSettlementFormFields,
  ...partnerDeliveryContactFormFields,
];
