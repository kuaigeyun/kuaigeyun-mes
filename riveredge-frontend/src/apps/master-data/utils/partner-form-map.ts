/**
 * 客户/供应商详情 → 表单字段（新建/编辑回填）
 */

import type { Customer, PartnerContact, Supplier } from '../types/supply-chain';

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

function partnerContactsFromDetail(d: {
  contacts?: PartnerContact[];
  contactPerson?: string;
  contactTitle?: string;
  phone?: string;
  email?: string;
}): PartnerContact[] {
  if (Array.isArray(d.contacts) && d.contacts.length > 0) {
    return d.contacts.map((row) => ({
      contactPerson: row.contactPerson,
      contactTitle: row.contactTitle,
      phone: row.phone,
      email: row.email,
    }));
  }
  if (d.contactPerson || d.contactTitle || d.phone || d.email) {
    return [
      {
        contactPerson: d.contactPerson,
        contactTitle: d.contactTitle,
        phone: d.phone,
        email: d.email,
      },
    ];
  }
  return [];
}

export function normalizePartnerContactsForSubmit(
  contacts: PartnerContact[] | undefined
): PartnerContact[] {
  if (!Array.isArray(contacts)) return [];
  return contacts
    .map((row) => {
      const contactPerson = row.contactPerson?.trim() || undefined;
      const contactTitle = row.contactTitle?.trim() || undefined;
      const phone = row.phone?.trim() || undefined;
      const email = row.email?.trim() || undefined;
      if (!contactPerson && !contactTitle && !phone && !email) return null;
      return { contactPerson, contactTitle, phone, email };
    })
    .filter((row): row is PartnerContact => row != null);
}

/** @deprecated 使用 normalizePartnerContactsForSubmit */
export const normalizeCustomerContactsForSubmit = normalizePartnerContactsForSubmit;

function partnerFormSliceWithoutFinance(d: Customer | Supplier) {
  const {
    financeContactName: _financeContactName,
    financeContactPhone: _financeContactPhone,
    financeContactEmail: _financeContactEmail,
    ...rest
  } = partnerFormSlice(d);
  return rest;
}

export function customerDetailToFormValues(d: Customer): Record<string, unknown> {
  return {
    code: d.code,
    name: d.name,
    shortName: d.shortName,
    contacts: partnerContactsFromDetail(d),
    address: d.address,
    category: d.category,
    industryCode: d.industryCode,
    customerLevelCode: d.customerLevelCode,
    leadSourceCode: d.leadSourceCode,
    estimatedAnnualPurchase: optNum(d.estimatedAnnualPurchase),
    creditLimit: optNum(d.creditLimit),
    revenueRecognitionOverride: d.revenueRecognitionOverride ?? undefined,
    salesmanId: d.salesmanId,
    isPublic: d.poolStatus === 'pool' || !d.salesmanId,
    isActive: d.isActive ?? true,
    ...partnerFormSliceWithoutFinance(d),
  };
}

export function supplierDetailToFormValues(d: Supplier): Record<string, unknown> {
  return {
    code: d.code,
    name: d.name,
    shortName: d.shortName,
    contacts: partnerContactsFromDetail(d),
    address: d.address,
    category: d.category,
    buyerId: d.buyerId,
    industryCode: d.industryCode,
    sourceChannelCode: d.sourceChannelCode,
    estimatedAnnualPurchase: optNum(d.estimatedAnnualPurchase),
    creditLimit: optNum(d.creditLimit),
    payableRecognitionOverride: d.payableRecognitionOverride ?? undefined,
    isActive: d.isActive ?? true,
    ...partnerFormSliceWithoutFinance(d),
  };
}

