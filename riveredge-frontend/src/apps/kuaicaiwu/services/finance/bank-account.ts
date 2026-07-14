import { apiRequest } from '../../../../services/api';
import { normalizeFinanceListResponse } from '../../utils/financeListCore';

export interface BankAccount {
  id: number;
  tenant_id: number;
  account_code: string;
  account_name: string;
  bank_name: string;
  account_number: string;
  currency: string;
  opening_balance: number;
  current_balance: number;
  is_active: boolean;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  created_by_name?: string;
  updated_by_name?: string;
  attachments?: Array<{ uid?: string; name?: string; status?: string; url?: string }>;
}

export interface BankAccountListParams {
  skip?: number;
  limit?: number;
  is_active?: boolean;
  keyword?: string;
  account_code?: string;
  account_name?: string;
  bank_name?: string;
  account_number?: string;
  created_start_date?: string;
  created_end_date?: string;
  updated_start_date?: string;
  updated_end_date?: string;
  sort_field?: string;
  sort_order?: string;
}

export interface BankTransactionListParams {
  skip?: number;
  limit?: number;
  keyword?: string;
  source_doc_code?: string;
  direction?: string;
  transaction_date_start?: string;
  transaction_date_end?: string;
  sort_field?: string;
  sort_order?: string;
}

const API = '/apps/kuaicaiwu/bank-accounts';

export const bankAccountService = {
  list: async (params?: BankAccountListParams) => {
    const res = await apiRequest<{ items?: BankAccount[]; total?: number } | BankAccount[]>(API, {
      method: 'GET',
      params,
    });
    return normalizeFinanceListResponse(res);
  },

  get: (id: number) =>
    apiRequest<BankAccount>(`${API}/${id}`, { method: 'GET' }),

  create: (data: Partial<BankAccount>) =>
    apiRequest<BankAccount>(API, { method: 'POST', data }),

  update: (id: number, data: Partial<BankAccount>) =>
    apiRequest<BankAccount>(`${API}/${id}`, { method: 'PUT', data }),

  delete: (id: number) =>
    apiRequest<void>(`${API}/${id}`, { method: 'DELETE' }),

  listTransactions: async (accountId: number, params?: BankTransactionListParams) => {
    const res = await apiRequest<{ items?: Array<Record<string, unknown>>; total?: number } | Array<Record<string, unknown>>>(
      `${API}/${accountId}/transactions`,
      { method: 'GET', params },
    );
    return normalizeFinanceListResponse(res);
  },

  importStatement: (accountId: number, csvContent: string) =>
    apiRequest<{ imported_count: number; current_balance: number }>(`${API}/${accountId}/import-statement`, {
      method: 'POST',
      data: { csv_content: csvContent },
    }),
};
