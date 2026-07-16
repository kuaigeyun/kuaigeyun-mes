import { apiRequest } from '../../../../services/api';

export interface DocumentReconciliationGapParams {
  partner_type: 'Customer' | 'Supplier';
  partner_id: number;
  start_date: string;
  end_date: string;
  only_gaps?: boolean;
  keyword?: string;
  doc_type?: string;
  doc_code?: string;
  sort_field?: string;
  sort_order?: string;
  skip?: number;
  limit?: number;
}

export interface FinanceAmountTriplet {
  quantity?: number;
  pushed_quantity?: number;
  max_push_quantity?: number;
}

export interface DocumentReconciliationGapItem extends FinanceAmountTriplet {
  doc_type?: string;
  doc_id?: number;
  doc_code?: string;
  amount?: number;
  remaining_amount?: number;
  unsettled_amount?: number;
  finance_related_count?: number;
  settlement_type?: string;
  gap_reason?: string | null;
}

export interface DocumentReconciliationGapResult {
  items?: DocumentReconciliationGapItem[];
  total?: number;
  gap_count?: number;
  open_balance_total?: number;
  partner_type?: string;
  partner_id?: number;
  period?: { start?: string; end?: string };
}

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

export interface FinancePipelineSummary {
  open_receivable_amount?: number;
  open_payable_amount?: number;
  unsettled_receipt_amount?: number;
  unsettled_payment_amount?: number;
  open_receivable_count?: number;
  open_payable_count?: number;
  unsettled_receipt_count?: number;
  unsettled_payment_count?: number;
  open_finance_document_count?: number;
  tip?: string;
}

const API = '/apps/kuaicaiwu/document-reconciliation';

export const documentReconciliationService = {
  listOpenGaps: (params: DocumentReconciliationGapParams) =>
    apiRequest<DocumentReconciliationGapResult>(`${API}/gaps/open`, { method: 'GET', params }),

  getStandardChain: (flowType: 'sales' | 'purchase', documentType: string, documentId: number) =>
    apiRequest<Record<string, unknown>>(`${API}/chain/${flowType}/${documentType}/${documentId}`, { method: 'GET' }),

  getPrepaymentBalances: (params?: PrepaymentBalanceListParams) =>
    apiRequest<PrepaymentBalanceSummary>(`${API}/prepayment-balances`, { method: 'GET', params }),
};
