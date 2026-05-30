import { apiRequest } from '../../../../services/api';

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

const RECEIPT_API = '/apps/kuaicaiwu/receipts';

export const receiptService = {
  listReceipts: (params: any) => {
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
};
