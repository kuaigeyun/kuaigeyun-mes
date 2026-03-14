import { apiRequest } from '../../../../services/api';
import { Receivable, ReceivableCreateData, ReceivableListParams, ReceiptRecordCreate } from '../../types/finance/receivable';

const RECEIVABLE_API = '/apps/kuaicaiwu/receivables';

export const receivableService = {
  createReceivable: (data: ReceivableCreateData) => {
    return apiRequest<Receivable>(RECEIVABLE_API, {
      method: 'POST',
      data,
    });
  },

  listReceivables: (params: ReceivableListParams) => {
    return apiRequest<{ items: Receivable[]; total: number }>(RECEIVABLE_API, {
      method: 'GET',
      params,
    });
  },

  getReceivable: (id: number) => {
    return apiRequest<Receivable>(`${RECEIVABLE_API}/${id}`, {
      method: 'GET',
    });
  },

  recordReceipt: (id: number, data: ReceiptRecordCreate) => {
    return apiRequest<Receivable>(`${RECEIVABLE_API}/${id}/receipt`, {
      method: 'POST',
      data,
    });
  },

  approveReceivable: (id: number, rejection_reason?: string) => {
    return apiRequest<Receivable>(`${RECEIVABLE_API}/${id}/approve`, {
      method: 'POST',
      params: { rejection_reason },
    });
  },

  deleteReceivable: (id: number) => {
    return apiRequest<void>(`${RECEIVABLE_API}/${id}`, {
      method: 'DELETE',
    });
  },
};
