import { apiRequest } from '../../../../services/api';
import type { DocumentPushPreview } from '../../../kuaizhizao/services/purchase-requisition';
import type { PaymentListParams, PaymentVoucher } from './payment';

export type PaymentRefundPullCandidate = {
  id: number;
  code: string;
  payment_code?: string;
  supplier_id?: number;
  supplier_name?: string;
  source_status?: string;
  source_date?: string;
  amount?: number;
  refunded_amount?: number;
  remaining_amount?: number;
  capabilities?: { pull_payment_refund?: { allowed?: boolean; reason?: string } };
};

export type PaymentRefundPullPreview = DocumentPushPreview & {
  source_type?: 'payment';
  source_ids?: number[];
  supplier_id?: number;
  supplier_name?: string;
  max_push_total?: number;
};

export type PaymentRefundCreateData = {
  supplier_id: number;
  supplier_name: string;
  total_amount: number;
  payment_date: string;
  payment_method: string;
  bank_account?: string;
  bank_account_id?: number;
  notes?: string;
  attachments?: unknown;
  source_type: 'payment';
  source_id?: number;
  source_ids?: number[];
};

const API = '/apps/kuaicaiwu/payment-refunds';

export const paymentRefundService = {
  create: (data: PaymentRefundCreateData) =>
    apiRequest<PaymentVoucher>(API, { method: 'POST', data }),

  list: (params: Omit<PaymentListParams, 'settlement_type'>) =>
    apiRequest<{ items: PaymentVoucher[]; total: number }>(API, { method: 'GET', params }),

  get: (id: number) => apiRequest<PaymentVoucher>(`${API}/${id}`, { method: 'GET' }),

  confirm: (id: number) => apiRequest<PaymentVoucher>(`${API}/${id}/confirm`, { method: 'POST' }),

  cancel: (id: number) => apiRequest<PaymentVoucher>(`${API}/${id}/cancel`, { method: 'POST' }),

  listPullCandidates: (params?: { skip?: number; limit?: number; keyword?: string }) =>
    apiRequest<{ data: PaymentRefundPullCandidate[]; total: number; success: boolean }>(
      `${API}/pull-candidates/payments`,
      { method: 'GET', params },
    ),

  previewPull: (paymentId: number) =>
    apiRequest<PaymentRefundPullPreview>(`${API}/from-payment/${paymentId}/pull-preview`, {
      method: 'GET',
    }),

  previewPullMulti: (paymentIds: number[]) =>
    apiRequest<PaymentRefundPullPreview>(`${API}/from-payments/pull-preview`, {
      method: 'GET',
      params: { payment_ids: paymentIds.join(',') },
    }),
};

export const PAYMENT_REFUND_RESOURCE = 'kuaicaiwu:payment-refund';
