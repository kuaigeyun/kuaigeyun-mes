import { apiRequest } from '../../../../services/api';

const API = '/apps/kuaicaiwu/prepayments';

export const prepaymentService = {
  applyToReceivable: (data: { receipt_id: number; receivable_id: number; amount: number }) =>
    apiRequest<Record<string, unknown>>(`${API}/apply-receivable`, { method: 'POST', data }),

  applyToPayable: (data: { payment_id: number; payable_id: number; amount: number }) =>
    apiRequest<Record<string, unknown>>(`${API}/apply-payable`, { method: 'POST', data }),
};
