import { apiRequest } from '../../../../services/api';
import type { DocumentPushPreview } from '../../../kuaizhizao/services/purchase-requisition';

export interface ReceiptVoucher {
  id: number;
  receipt_code: string;
  customer_id: number;
  customer_name: string;
  total_amount: number;
  settled_amount: number;
  unsettled_amount: number;
  receipt_date: string;
  payment_method: string;
  bank_account?: string;
  bank_account_id?: number;
  status: string;
  settlement_type?: string;
  notes?: string;
  created_at: string;
}

export type ReceiptPullPreview = DocumentPushPreview & {
  source_type?: 'receivable';
  customer_id?: number;
  customer_name?: string;
  receivable_id?: number | null;
  receivable_code?: string | null;
};

export type ReceiptPullCandidate = {
  id: number;
  code: string;
  receivable_code?: string;
  customer_name?: string;
  source_status?: string;
  review_status?: string;
  source_date?: string;
  amount?: number;
  remaining_amount?: number;
  capabilities?: { pull_receipt?: { allowed?: boolean; reason?: string } };
};

export type ReceiptCreateData = {
  customer_id: number;
  customer_name: string;
  total_amount: number;
  receipt_date: string;
  payment_method: string;
  bank_account?: string;
  bank_account_id?: number;
  settlement_type?: string;
  notes?: string;
  attachments?: unknown;
  source_type?: 'receivable';
  source_id?: number;
};

const RECEIPT_API = '/apps/kuaicaiwu/receipts';

export const receiptService = {
  create: (data: ReceiptCreateData) =>
    apiRequest<ReceiptVoucher>(RECEIPT_API, {
      method: 'POST',
      data,
    }),

  listReceipts: (params: Record<string, unknown>) => {
    return apiRequest<{ items: ReceiptVoucher[]; total: number }>(RECEIPT_API, {
      method: 'GET',
      params,
    });
  },

  getReceipt: (id: number) => {
    return apiRequest<ReceiptVoucher>(`${RECEIPT_API}/${id}`, {
      method: 'GET',
    });
  },

  confirmReceipt: (id: number) => {
    return apiRequest<ReceiptVoucher>(`${RECEIPT_API}/${id}/confirm`, {
      method: 'POST',
    });
  },

  cancelReceipt: (id: number) => {
    return apiRequest<ReceiptVoucher>(`${RECEIPT_API}/${id}/cancel`, {
      method: 'POST',
    });
  },

  deleteReceipt: (id: number) => {
    return apiRequest<void>(`${RECEIPT_API}/${id}`, {
      method: 'DELETE',
    });
  },

  listReceivablePullCandidates: async (params?: { skip?: number; limit?: number; keyword?: string }) =>
    apiRequest<{ data: ReceiptPullCandidate[]; total: number; success: boolean }>(
      `${RECEIPT_API}/pull-candidates/receivables`,
      { method: 'GET', params },
    ),

  previewPullFromReceivable: async (receivableId: number) =>
    apiRequest<ReceiptPullPreview>(`${RECEIPT_API}/from-receivable/${receivableId}/pull-preview`, {
      method: 'GET',
    }),
};
