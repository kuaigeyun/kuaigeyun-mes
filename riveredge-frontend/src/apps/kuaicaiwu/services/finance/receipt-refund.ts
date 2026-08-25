import { apiRequest } from '../../../../services/api';
import type { DocumentPushPreview } from '../../../kuaizhizao/services/purchase-requisition';
import type { ReceiptListParams, ReceiptVoucher } from './receipt';

export type ReceiptRefundPullCandidate = {
  id: number;
  code: string;
  receipt_code?: string;
  customer_name?: string;
  source_status?: string;
  source_date?: string;
  amount?: number;
  refunded_amount?: number;
  remaining_amount?: number;
  capabilities?: { pull_receipt_refund?: { allowed?: boolean; reason?: string } };
};

export type ReceiptRefundPullPreview = DocumentPushPreview & {
  source_type?: 'receipt';
  customer_id?: number;
  customer_name?: string;
};

export type ReceiptRefundCreateData = {
  customer_id: number;
  customer_name: string;
  total_amount: number;
  receipt_date: string;
  payment_method: string;
  bank_account?: string;
  bank_account_id?: number;
  notes?: string;
  attachments?: unknown;
  source_type: 'receipt';
  source_id: number;
};

const API = '/apps/kuaicaiwu/receipt-refunds';

export const receiptRefundService = {
  create: (data: ReceiptRefundCreateData) =>
    apiRequest<ReceiptVoucher>(API, { method: 'POST', data }),

  list: (params: Omit<ReceiptListParams, 'settlement_type'>) =>
    apiRequest<{ items: ReceiptVoucher[]; total: number }>(API, { method: 'GET', params }),

  get: (id: number) => apiRequest<ReceiptVoucher>(`${API}/${id}`, { method: 'GET' }),

  confirm: (id: number) => apiRequest<ReceiptVoucher>(`${API}/${id}/confirm`, { method: 'POST' }),

  cancel: (id: number) => apiRequest<ReceiptVoucher>(`${API}/${id}/cancel`, { method: 'POST' }),

  listPullCandidates: (params?: { skip?: number; limit?: number; keyword?: string }) =>
    apiRequest<{ data: ReceiptRefundPullCandidate[]; total: number; success: boolean }>(
      `${API}/pull-candidates/receipts`,
      { method: 'GET', params },
    ),

  previewPull: (receiptId: number) =>
    apiRequest<ReceiptRefundPullPreview>(`${API}/from-receipt/${receiptId}/pull-preview`, {
      method: 'GET',
    }),
};

export const RECEIPT_REFUND_RESOURCE = 'kuaicaiwu:receipt-refund';
