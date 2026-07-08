import { apiRequest } from '../../../../services/api';
import type { DocumentPushPreview } from '../../../kuaizhizao/services/purchase-requisition';

export interface PaymentListParams {
  skip?: number;
  limit?: number;
  status?: string;
  supplier_id?: number;
  unsettled_only?: boolean;
  settlement_type?: string;
  start_date?: string;
  end_date?: string;
  keyword?: string;
  payment_code?: string;
  supplier_name?: string;
  created_start_date?: string;
  created_end_date?: string;
  updated_start_date?: string;
  updated_end_date?: string;
  sort_field?: string;
  sort_order?: 'asc' | 'desc';
}

export interface PaymentVoucher {
  id: number;
  payment_code: string;
  supplier_id: number;
  supplier_name: string;
  total_amount: number;
  settled_amount: number;
  unsettled_amount: number;
  payment_date: string;
  payment_method: string;
  bank_account?: string;
  bank_account_id?: number;
  status: string;
  settlement_type?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export type PaymentPullPreview = DocumentPushPreview & {
  source_type?: 'payable';
  supplier_id?: number;
  supplier_name?: string;
  payable_id?: number | null;
  payable_code?: string | null;
};

export type PaymentPullCandidate = {
  id: number;
  code: string;
  payable_code?: string;
  supplier_name?: string;
  source_status?: string;
  review_status?: string;
  source_date?: string;
  amount?: number;
  remaining_amount?: number;
  capabilities?: { pull_payment?: { allowed?: boolean; reason?: string } };
};

export type PaymentCreateData = {
  supplier_id: number;
  supplier_name: string;
  total_amount: number;
  payment_date: string;
  payment_method: string;
  bank_account?: string;
  bank_account_id?: number;
  settlement_type?: string;
  notes?: string;
  attachments?: unknown;
  source_type?: 'payable';
  source_id?: number;
};

const PAYMENT_API = '/apps/kuaicaiwu/payments';

export const paymentService = {
  create: (data: PaymentCreateData) =>
    apiRequest<PaymentVoucher>(PAYMENT_API, {
      method: 'POST',
      data,
    }),

  listPayments: (params: PaymentListParams) => {
    return apiRequest<{ items: PaymentVoucher[]; total: number }>(PAYMENT_API, {
      method: 'GET',
      params,
    });
  },

  getPayment: (id: number) => {
    return apiRequest<PaymentVoucher>(`${PAYMENT_API}/${id}`, {
      method: 'GET',
    });
  },

  confirmPayment: (id: number) => {
    return apiRequest<PaymentVoucher>(`${PAYMENT_API}/${id}/confirm`, {
      method: 'POST',
    });
  },

  cancelPayment: (id: number) => {
    return apiRequest<PaymentVoucher>(`${PAYMENT_API}/${id}/cancel`, {
      method: 'POST',
    });
  },

  listPayablePullCandidates: async (params?: { skip?: number; limit?: number; keyword?: string }) =>
    apiRequest<{ data: PaymentPullCandidate[]; total: number; success: boolean }>(
      `${PAYMENT_API}/pull-candidates/payables`,
      { method: 'GET', params },
    ),

  previewPullFromPayable: async (payableId: number) =>
    apiRequest<PaymentPullPreview>(`${PAYMENT_API}/from-payable/${payableId}/pull-preview`, {
      method: 'GET',
    }),
};
