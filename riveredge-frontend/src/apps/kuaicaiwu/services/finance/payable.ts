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

  deletePayable: (id: number) => {
    return apiRequest<void>(`${PAYABLE_API}/${id}`, {
      method: 'DELETE',
    });
  },

  mergeCreatePayment: (data: MergePaymentCreatePayload) =>
    apiRequest<MergeFinanceVoucherResult>(`${PAYABLE_API}/merge-payment`, {
      method: 'POST',
      data,
    }),

  mergeCreatePurchaseInvoice: (data: MergePurchaseInvoiceCreatePayload) =>
    apiRequest<MergeFinanceVoucherResult>(`${PAYABLE_API}/merge-purchase-invoice`, {
      method: 'POST',
      data,
    }),
};

export type MergeFinanceAllocationLine = {
  source_id: number;
  amount: number;
};

export type MergeFinanceVoucherResult = {
  voucher_type: string;
  voucher_id: number;
  voucher_code: string;
  total_amount: number;
  partner_id: number;
  partner_name: string;
  allocations: Array<{ source_id: number; source_code?: string; amount: number }>;
};

export type MergePaymentCreatePayload = {
  allocations: MergeFinanceAllocationLine[];
  payment_date: string;
  payment_method: string;
  bank_account?: string;
  bank_account_id?: number;
  settlement_type?: string;
  notes?: string;
  attachments?: Record<string, unknown>[];
};

export type MergePurchaseInvoiceCreatePayload = {
  allocations: MergeFinanceAllocationLine[];
  invoice_date: string;
  invoice_number: string;
  invoice_type?: string;
  tax_rate?: number;
  notes?: string;
};
