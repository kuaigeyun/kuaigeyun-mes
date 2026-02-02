import { apiRequest } from '../../../../services/api';
import { Payable, PayableListParams, PaymentRecordCreate } from '../../types/finance/payable';

const PAYABLE_API = '/apps/kuaizhizao/payables';

export const payableService = {
  listPayables: (params: PayableListParams) => {
    return apiRequest<{ items: Payable[]; total: number }>(PAYABLE_API, {
      method: 'GET',
      params,
    });
  },

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
};
