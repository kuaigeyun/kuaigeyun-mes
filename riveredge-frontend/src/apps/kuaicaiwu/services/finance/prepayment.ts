import { apiRequest } from '../../../../services/api';

const API = '/apps/kuaicaiwu/prepayments';

export interface PrepaymentBalanceListParams {
  partner_type?: 'customer' | 'supplier';
  keyword?: string;
  partner_name?: string;
  skip?: number;
  limit?: number;
  sort_field?: string;
  sort_order?: string;
}

export interface PrepaymentBalanceSummary {
  customer_balances?: Array<Record<string, unknown>>;
  supplier_balances?: Array<Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
  total?: number;
  total_customer_prepayment?: number;
  total_supplier_prepayment?: number;
}

export const prepaymentService = {
  getBalances: (params?: PrepaymentBalanceListParams) =>
    apiRequest<PrepaymentBalanceSummary>(`${API}/balances`, { method: 'GET', params }),

  applyToReceivable: (data: { receipt_id: number; receivable_id: number; amount: number }) =>
    apiRequest<Record<string, unknown>>(`${API}/apply-receivable`, { method: 'POST', data }),

  applyToPayable: (data: { payment_id: number; payable_id: number; amount: number }) =>
    apiRequest<Record<string, unknown>>(`${API}/apply-payable`, { method: 'POST', data }),
};
