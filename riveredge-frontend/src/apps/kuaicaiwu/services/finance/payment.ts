import { apiRequest } from '../../../../services/api';

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
}

const PAYMENT_API = '/apps/kuaicaiwu/payments';

export const paymentService = {
  listPayments: (params: Record<string, unknown>) => {
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
};
