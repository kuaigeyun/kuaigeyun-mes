import { apiRequest } from '../../../../services/api';

export interface ChartOfAccount {
  id: number;
  tenant_id: number;
  account_code: string;
  account_name: string;
  account_type: string;
  parent_id?: number;
  balance_direction: string;
  level: number;
  is_leaf: boolean;
  is_active: boolean;
  notes?: string;
}

export interface Voucher {
  id: number;
  tenant_id: number;
  voucher_code: string;
  voucher_date: string;
  period_year: number;
  period_month: number;
  status: string;
  summary?: string;
  total_debit: number;
  total_credit: number;
}

export interface VoucherLine {
  line_no: number;
  account_code: string;
  account_name: string;
  summary?: string;
  debit_amount: number;
  credit_amount: number;
}

const GL_API = '/apps/kuaicaiwu/gl';

export const glService = {
  listAccounts: (params?: { is_active?: boolean }) =>
    apiRequest<ChartOfAccount[]>(`${GL_API}/accounts`, { method: 'GET', params }),

  createAccount: (data: Partial<ChartOfAccount>) =>
    apiRequest<ChartOfAccount>(`${GL_API}/accounts`, { method: 'POST', data }),

  listVouchers: (params?: { skip?: number; limit?: number; status?: string }) =>
    apiRequest<Voucher[]>(`${GL_API}/vouchers`, { method: 'GET', params }),

  postVoucher: (id: number) =>
    apiRequest<Voucher>(`${GL_API}/vouchers/${id}/post`, { method: 'POST' }),

  listVoucherLines: (id: number) =>
    apiRequest<VoucherLine[]>(`${GL_API}/vouchers/${id}/lines`, { method: 'GET' }),

  exportVouchersCsv: (params?: { status?: string }) =>
    apiRequest<string>(`${GL_API}/vouchers/export/csv`, { method: 'GET', params }),
};
