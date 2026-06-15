import { apiRequest } from '../../../../services/api';

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
  attachments?: Array<{ uid?: string; name?: string; status?: string; url?: string }>;
}

const API = '/apps/kuaicaiwu/bank-accounts';

export const bankAccountService = {
  list: (params?: { skip?: number; limit?: number; is_active?: boolean }) =>
    apiRequest<BankAccount[]>(API, { method: 'GET', params }),

  get: (id: number) =>
    apiRequest<BankAccount>(`${API}/${id}`, { method: 'GET' }),

  create: (data: Partial<BankAccount>) =>
    apiRequest<BankAccount>(API, { method: 'POST', data }),

  update: (id: number, data: Partial<BankAccount>) =>
    apiRequest<BankAccount>(`${API}/${id}`, { method: 'PUT', data }),

  delete: (id: number) =>
    apiRequest<void>(`${API}/${id}`, { method: 'DELETE' }),

  listTransactions: (accountId: number, params?: { skip?: number; limit?: number }) =>
    apiRequest<Array<Record<string, unknown>>>(`${API}/${accountId}/transactions`, { method: 'GET', params }),

  importStatement: (accountId: number, csvContent: string) =>
    apiRequest<{ imported_count: number; current_balance: number }>(`${API}/${accountId}/import-statement`, {
      method: 'POST',
      data: { csv_content: csvContent },
    }),
};
