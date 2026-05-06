/**
 * 客户/供应商详情中静态编码字段的展示（非数据字典）
 */

import type { TFunction } from 'i18next';

const INVOICE_TYPE_KEYS: Record<string, string> = {
  digital_vat_special: 'field.partner.invoiceType.digitalSpecial',
  digital_vat_ordinary: 'field.partner.invoiceType.digitalOrdinary',
  /** 历史存档数据（纸质 / 旧版电子票编码） */
  vat_ordinary: 'field.partner.invoiceType.legacyVatOrdinary',
  vat_special: 'field.partner.invoiceType.legacyVatSpecial',
  vat_e_special: 'field.partner.invoiceType.legacyVatESpecial',
  vat_e_ordinary: 'field.partner.invoiceType.legacyVatEOrdinary',
};

const TAXPAYER_TYPE_KEYS: Record<string, string> = {
  general: 'field.partner.taxpayerType.general',
  small_scale: 'field.partner.taxpayerType.smallScale',
  non_enterprise: 'field.partner.taxpayerType.nonEnterprise',
};

const ENTERPRISE_TYPE_KEYS: Record<string, string> = {
  limited_liability: 'field.partner.enterpriseType.limitedLiability',
  company_limited_by_shares: 'field.partner.enterpriseType.companyLimitedByShares',
  sole_proprietorship: 'field.partner.enterpriseType.soleProprietorship',
  partnership: 'field.partner.enterpriseType.partnership',
  individual_business: 'field.partner.enterpriseType.individualBusiness',
  other: 'field.partner.enterpriseType.other',
};

const SETTLEMENT_KEYS: Record<string, string> = {
  cash: 'field.partner.settlementMethod.cash',
  bank_transfer: 'field.partner.settlementMethod.bankTransfer',
  bank_acceptance: 'field.partner.settlementMethod.bankAcceptance',
  commercial_acceptance: 'field.partner.settlementMethod.commercialAcceptance',
  monthly: 'field.partner.settlementMethod.monthly',
  prepaid: 'field.partner.settlementMethod.prepaid',
  other: 'field.partner.settlementMethod.other',
};

function mapLabel(t: TFunction, map: Record<string, string>, code?: string | null): string {
  if (code == null || code === '') return '—';
  const key = map[code];
  if (!key) return code;
  const text = t(key);
  return text === key ? code : text;
}

export function partnerInvoiceTypeLabel(t: TFunction, code?: string | null): string {
  return mapLabel(t, INVOICE_TYPE_KEYS, code);
}

export function partnerTaxpayerTypeLabel(t: TFunction, code?: string | null): string {
  return mapLabel(t, TAXPAYER_TYPE_KEYS, code);
}

export function partnerEnterpriseTypeLabel(t: TFunction, code?: string | null): string {
  return mapLabel(t, ENTERPRISE_TYPE_KEYS, code);
}

export function partnerSettlementMethodLabel(t: TFunction, code?: string | null): string {
  return mapLabel(t, SETTLEMENT_KEYS, code);
}

/** 客户主数据 — 应收确认覆盖（空=跟随组织） */
export function partnerRevenueRecognitionOverrideLabel(t: TFunction, code?: string | null): string {
  if (code == null || code === '') return t('field.partner.recognitionOverrideInherit');
  if (code === 'on_shipment') return t('pages.system.configCenter.param.finance_revenue_recognition_opt_on_shipment');
  if (code === 'on_invoice') return t('pages.system.configCenter.param.finance_revenue_recognition_opt_on_invoice');
  return code;
}

/** 供应商主数据 — 应付确认覆盖（空=跟随组织） */
export function partnerPayableRecognitionOverrideLabel(t: TFunction, code?: string | null): string {
  if (code == null || code === '') return t('field.partner.recognitionOverrideInherit');
  if (code === 'on_receipt') return t('pages.system.configCenter.param.finance_payable_recognition_opt_on_receipt');
  if (code === 'on_purchase_invoice') {
    return t('pages.system.configCenter.param.finance_payable_recognition_opt_on_purchase_invoice');
  }
  return code;
}
