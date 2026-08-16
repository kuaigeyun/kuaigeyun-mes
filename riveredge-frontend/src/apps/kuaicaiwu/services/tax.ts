/**
 * 税务管理 API
 */
import { apiRequest } from '../../../services/api';

const BASE = '/apps/kuaicaiwu/tax';

export type TaxRateItem = {
  rate: number;
  label: string;
  is_active: boolean;
};

export type TaxSettings = {
  id: number;
  tenant_id: number;
  taxpayer_type: 'general' | 'small_scale';
  tax_rates: TaxRateItem[];
  surcharge_rates: {
    urban_construction: number;
    education: number;
    local_education: number;
  };
  account_bindings: Record<string, number | null>;
};

export type VatLedgerSummary = {
  period_year: number;
  period_month: number;
  tax_period: string;
  taxpayer_type: string;
  output_tax: number;
  input_tax: number;
  transfer_out: number;
  tax_payable: number;
  surcharge_urban: number;
  surcharge_education: number;
  surcharge_local_education: number;
  surcharge_total: number;
  locked: boolean;
  vat_transfer_voucher_id?: number | null;
  surcharge_voucher_id?: number | null;
};

export const taxService = {
  getSettings: () => apiRequest<TaxSettings>(`${BASE}/settings`),
  updateSettings: (data: Partial<TaxSettings>) =>
    apiRequest<TaxSettings>(`${BASE}/settings`, { method: 'PUT', data }),
  supplementCoa: () =>
    apiRequest<{ created_codes: string[]; account_bindings: Record<string, number> }>(
      `${BASE}/settings/supplement-coa`,
      { method: 'POST' },
    ),
  getVatLedger: (year: number, month: number) =>
    apiRequest<VatLedgerSummary>(`${BASE}/vat-ledger`, { params: { year, month } }),
  listVatLedgerInvoices: (params: {
    year: number;
    month: number;
    kind: 'output' | 'input' | 'transfer_out';
    skip?: number;
    limit?: number;
  }) => apiRequest<{ items: Record<string, unknown>[]; total: number }>(`${BASE}/vat-ledger/invoices`, { params }),
  getVatLedgerPrint: (year: number, month: number) =>
    apiRequest<{ summary: VatLedgerSummary; unit: string }>(`${BASE}/vat-ledger/print`, {
      params: { year, month },
    }),
  createVatVoucher: (year: number, month: number) =>
    apiRequest<{ voucher_id: number; voucher_code: string }>(`${BASE}/vat-ledger/vat-voucher`, {
      method: 'POST',
      data: { year, month },
    }),
  createSurchargeVoucher: (year: number, month: number) =>
    apiRequest<{ voucher_id: number; voucher_code: string }>(`${BASE}/vat-ledger/surcharge-voucher`, {
      method: 'POST',
      data: { year, month },
    }),
  lockPeriod: (year: number, month: number) =>
    apiRequest(`${BASE}/vat-ledger/lock`, { method: 'POST', data: { year, month } }),
  listInputCertification: (params?: {
    skip?: number;
    limit?: number;
    verification_status?: string;
    keyword?: string;
  }) =>
    apiRequest<{ items: Record<string, unknown>[]; total: number }>(`${BASE}/input-certification`, {
      params,
    }),
  certify: (invoiceId: number, verificationDate?: string) =>
    apiRequest(`${BASE}/purchase-invoices/${invoiceId}/certify`, {
      method: 'POST',
      params: verificationDate ? { verification_date: verificationDate } : undefined,
    }),
  batchCertify: (invoiceIds: number[], verificationDate?: string) =>
    apiRequest<{ certified: number[]; errors: { id: number; message: string }[] }>(
      `${BASE}/purchase-invoices/batch-certify`,
      {
        method: 'POST',
        data: { invoice_ids: invoiceIds, verification_date: verificationDate || null },
      },
    ),
  transferOut: (invoiceId: number, reason: string) =>
    apiRequest(`${BASE}/purchase-invoices/${invoiceId}/transfer-out`, {
      method: 'POST',
      data: { reason },
    }),
  redFlush: (invoiceId: number, reason: string) =>
    apiRequest(`${BASE}/purchase-invoices/${invoiceId}/red-flush`, {
      method: 'POST',
      data: { reason },
    }),
};
