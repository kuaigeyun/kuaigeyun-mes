import { apiRequest } from '../../../../services/api';

export interface DocumentReconciliationGapParams {
  partner_type: 'Customer' | 'Supplier';
  partner_id: number;
  start_date: string;
  end_date: string;
  only_gaps?: boolean;
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
  gap_count?: number;
  open_balance_total?: number;
  partner_type?: string;
  partner_id?: number;
  period?: { start?: string; end?: string };
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

  getPipelineSummary: () =>
    apiRequest<FinancePipelineSummary>(`${API}/pipeline-summary`, { method: 'GET' }),

  reconcileDocument: (documentType: string, documentId: number) =>
    apiRequest<Record<string, unknown>>(`${API}/${documentType}/${documentId}`, { method: 'GET' }),

  getStandardChain: (flowType: 'sales' | 'purchase', documentType: string, documentId: number) =>
    apiRequest<Record<string, unknown>>(`${API}/chain/${flowType}/${documentType}/${documentId}`, { method: 'GET' }),

  getPrepaymentBalances: () =>
    apiRequest<Record<string, unknown>>(`${API}/prepayment-balances`, { method: 'GET' }),
};
