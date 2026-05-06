/**
 * 客户/供应商详情 → 表单字段（新建/编辑回填）
 */

import type { Customer, Supplier } from '../types/supply-chain';

function optNum(v: number | string | null | undefined): number | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

const partnerFormSlice = (d: Customer | Supplier) => ({
  taxRegistrationNo: d.taxRegistrationNo ?? undefined,
  invoiceTitle: d.invoiceTitle ?? undefined,
  invoiceAddress: d.invoiceAddress ?? undefined,
  invoicePhone: d.invoicePhone ?? undefined,
  invoiceBankName: d.invoiceBankName ?? undefined,
  invoiceBankAccount: d.invoiceBankAccount ?? undefined,
  invoiceTypeCode: d.invoiceTypeCode ?? undefined,
  taxpayerTypeCode: d.taxpayerTypeCode ?? undefined,
  legalRepresentative: d.legalRepresentative ?? undefined,
  enterpriseTypeCode: d.enterpriseTypeCode ?? undefined,
  paymentTermsDays: optNum(d.paymentTermsDays as number | string | undefined),
  settlementMethodCode: d.settlementMethodCode ?? undefined,
  financeContactName: d.financeContactName ?? undefined,
  financeContactPhone: d.financeContactPhone ?? undefined,
  financeContactEmail: d.financeContactEmail ?? undefined,
  deliveryContactName: d.deliveryContactName ?? undefined,
  deliveryContactPhone: d.deliveryContactPhone ?? undefined,
  deliveryAddress: d.deliveryAddress ?? undefined,
});

export function customerDetailToFormValues(d: Customer): Record<string, unknown> {
  return {
    code: d.code,
    name: d.name,
    shortName: d.shortName,
    contactPerson: d.contactPerson,
    contactTitle: d.contactTitle,
    phone: d.phone,
    email: d.email,
    address: d.address,
    category: d.category,
    industryCode: d.industryCode,
    customerLevelCode: d.customerLevelCode,
    leadSourceCode: d.leadSourceCode,
    estimatedAnnualPurchase: optNum(d.estimatedAnnualPurchase),
    creditLimit: optNum(d.creditLimit),
    revenueRecognitionOverride: d.revenueRecognitionOverride ?? undefined,
    salesmanId: d.salesmanId,
    isActive: d.isActive ?? true,
    isPublic: d.isPublic ?? false,
    ...partnerFormSlice(d),
  };
}

export function supplierDetailToFormValues(d: Supplier): Record<string, unknown> {
  return {
    code: d.code,
    name: d.name,
    shortName: d.shortName,
    contactPerson: d.contactPerson,
    contactTitle: d.contactTitle,
    phone: d.phone,
    email: d.email,
    address: d.address,
    category: d.category,
    buyerId: d.buyerId,
    industryCode: d.industryCode,
    sourceChannelCode: d.sourceChannelCode,
    estimatedAnnualPurchase: optNum(d.estimatedAnnualPurchase),
    creditLimit: optNum(d.creditLimit),
    payableRecognitionOverride: d.payableRecognitionOverride ?? undefined,
    isActive: d.isActive ?? true,
    ...partnerFormSlice(d),
  };
}
