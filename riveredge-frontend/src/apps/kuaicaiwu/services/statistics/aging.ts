import { apiRequest } from '../../../../services/api';

export type AgingBucket = {
  count: number;
  amount: number;
};

export type AgingAnalysis = Record<string, AgingBucket>;

const RECEIVABLE_API = '/apps/kuaicaiwu/receivables';
const PAYABLE_API = '/apps/kuaicaiwu/payables';

export const agingService = {
  getReceivableAging: () =>
    apiRequest<AgingAnalysis>(`${RECEIVABLE_API}/aging`, { method: 'GET' }),

  getPayableAging: () =>
    apiRequest<AgingAnalysis>(`${PAYABLE_API}/aging`, { method: 'GET' }),
};
