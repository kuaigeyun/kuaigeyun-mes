import { apiRequest } from '../../../../services/api';
import { Receivable, ReceivableListParams, ReceiptRecordCreate } from '../../types/finance/receivable';

const RECEIVABLE_API = '/apps/kuaizhizao/receivables';

export const receivableService = {
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
};
