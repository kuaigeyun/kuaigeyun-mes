import { apiRequest } from '../../../../services/api';

export interface DocumentReconciliationGapParams {
  partner_type: 'Customer' | 'Supplier';
  partner_id: number;
  start_date: string;
  end_date: string;
  only_gaps?: boolean;
}

const API = '/apps/kuaicaiwu/document-reconciliation';

export const documentReconciliationService = {
  listOpenGaps: (params: DocumentReconciliationGapParams) =>
    apiRequest<Record<string, unknown>>(`${API}/gaps/open`, { method: 'GET', params }),

  reconcileDocument: (documentType: string, documentId: number) =>
    apiRequest<Record<string, unknown>>(`${API}/${documentType}/${documentId}`, { method: 'GET' }),

  getStandardChain: (flowType: 'sales' | 'purchase', documentType: string, documentId: number) =>
    apiRequest<Record<string, unknown>>(`${API}/chain/${flowType}/${documentType}/${documentId}`, { method: 'GET' }),

  getPrepaymentBalances: () =>
    apiRequest<Record<string, unknown>>(`${API}/prepayment-balances`, { method: 'GET' }),
};
