import { apiRequest } from '../../../../services/api';
import type { DocumentPushPreview } from '../../../kuaizhizao/services/purchase-requisition';
import { Payable, PayableCreateData, PayableListParams, PaymentRecordCreate } from '../../types/finance/payable';

const PAYABLE_API = '/apps/kuaicaiwu/payables';

export type PayablePullPreview = DocumentPushPreview & {
  source_type?: 'purchase_order' | 'purchase_receipt';
  supplier_id?: number;
  supplier_name?: string;
  purchase_order_id?: number | null;
  purchase_order_code?: string | null;
};

export type PayablePullCandidate = {
  id: number;
  code: string;
  order_code?: string;
  receipt_code?: string;
  supplier_name?: string;
  source_status?: string;
  source_date?: string;
  amount?: number;
  capabilities?: { pull_payable?: { allowed?: boolean; reason?: string } };
};

export type PayableListItem = Payable & {
  capabilities?: { push_payment?: { allowed?: boolean; reason?: string } };
};

export const payableService = {
  createPayable: (data: PayableCreateData) => {
    return apiRequest<Payable>(PAYABLE_API, {
      method: 'POST',
      data,
    });
  },

  listPayables: (params: PayableListParams) => {
    return apiRequest<{ items: PayableListItem[]; total: number }>(PAYABLE_API, {
      method: 'GET',
      params,
    });
  },

  listPurchaseOrderPullCandidates: async (params?: { skip?: number; limit?: number; keyword?: string }) =>
    apiRequest<{ data: PayablePullCandidate[]; total: number; success: boolean }>(
      `${PAYABLE_API}/pull-candidates/purchase-orders`,
      { method: 'GET', params },
    ),

  listPurchaseReceiptPullCandidates: async (params?: { skip?: number; limit?: number; keyword?: string }) =>
    apiRequest<{ data: PayablePullCandidate[]; total: number; success: boolean }>(
      `${PAYABLE_API}/pull-candidates/purchase-receipts`,
      { method: 'GET', params },
    ),

  previewPullFromPurchaseOrder: async (orderId: number) =>
    apiRequest<PayablePullPreview>(`${PAYABLE_API}/from-purchase-order/${orderId}/pull-preview`, {
      method: 'GET',
    }),

  previewPullFromPurchaseReceipt: async (receiptId: number) =>
    apiRequest<PayablePullPreview>(`${PAYABLE_API}/from-purchase-receipt/${receiptId}/pull-preview`, {
      method: 'GET',
    }),

  getPayable: (id: number) => {
    return apiRequest<Payable>(`${PAYABLE_API}/${id}`, {
      method: 'GET',
    });
  },

  recordPayment: (id: number, data: PaymentRecordCreate) => {
    return apiRequest<Payable>(`${PAYABLE_API}/${id}/payment`, {
      method: 'POST',
      data,
    });
  },

  approvePayable: (id: number, rejection_reason?: string) => {
    return apiRequest<Payable>(`${PAYABLE_API}/${id}/approve`, {
      method: 'POST',
      params: { rejection_reason },
    });
  },

  deletePayable: (id: number) => {
    return apiRequest<void>(`${PAYABLE_API}/${id}`, {
      method: 'DELETE',
    });
  },
};
