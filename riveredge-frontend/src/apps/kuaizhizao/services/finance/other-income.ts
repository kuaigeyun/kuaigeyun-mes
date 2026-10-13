import { apiRequest } from '../../../../services/api';

export const OTHER_INCOME_RESOURCE = 'kuaicaiwu:other-income';

const base = '/apps/kuaicaiwu/other-incomes';

export type OtherVoucherLine = {
  id?: number;
  line_no?: number;
  category_code: string;
  category_name?: string;
  amount: number;
  description?: string;
  gl_account_code?: string;
};

export type OtherIncomeVoucher = {
  id: number;
  income_code: string;
  business_date: string;
  counterparty_kind: string;
  counterparty_id?: number;
  counterparty_name?: string;
  total_amount: number;
  payment_method: string;
  bank_account_id?: number;
  status: string;
  notes?: string;
  attachments?: unknown[];
  lines: OtherVoucherLine[];
  capabilities?: Record<string, { allowed: boolean; reason?: string }>;
};

export const otherIncomeService = {
  list: (params?: Record<string, unknown>) =>
    apiRequest<{ items: OtherIncomeVoucher[]; total: number }>(base, { method: 'GET', params }),
  get: (id: number) => apiRequest<OtherIncomeVoucher>(`${base}/${id}`, { method: 'GET' }),
  create: (data: Record<string, unknown>) => apiRequest<OtherIncomeVoucher>(base, { method: 'POST', data }),
  update: (id: number, data: Record<string, unknown>) =>
    apiRequest<OtherIncomeVoucher>(`${base}/${id}`, { method: 'PUT', data }),
  delete: (id: number) => apiRequest(`${base}/${id}`, { method: 'DELETE' }),
  submit: (id: number) => apiRequest<OtherIncomeVoucher>(`${base}/${id}/submit`, { method: 'POST' }),
  approve: (id: number, body?: { review_remarks?: string }) =>
    apiRequest<OtherIncomeVoucher>(`${base}/${id}/approve`, { method: 'POST', data: { approved: true, ...body } }),
  reject: (id: number, body?: { review_remarks?: string }) =>
    apiRequest<OtherIncomeVoucher>(`${base}/${id}/reject`, { method: 'POST', data: { approved: false, ...body } }),
  confirm: (id: number) => apiRequest<OtherIncomeVoucher>(`${base}/${id}/confirm`, { method: 'POST' }),
  unconfirm: (id: number) => apiRequest<OtherIncomeVoucher>(`${base}/${id}/unconfirm`, { method: 'POST' }),
  cancel: (id: number) => apiRequest<OtherIncomeVoucher>(`${base}/${id}/cancel`, { method: 'POST' }),
};
