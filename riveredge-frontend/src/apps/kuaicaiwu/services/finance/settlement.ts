import { apiRequest } from '../../../../services/api';
import { SettlementRecord, PartnerStatement } from '../../types/finance/settlement';

const SETTLEMENT_API = '/apps/kuaicaiwu/settlement';

export const settlementService = {
  settleReceivable: (receivable_id: number, receipt_id: number, amount: number) => {
    return apiRequest<SettlementRecord>(`${SETTLEMENT_API}/receivable`, {
      method: 'POST',
      params: { receivable_id, receipt_id, amount },
    });
  },

  settlePayable: (payable_id: number, payment_id: number, amount: number) => {
    return apiRequest<SettlementRecord>(`${SETTLEMENT_API}/payable`, {
      method: 'POST',
      params: { payable_id, payment_id, amount },
    });
  },

  autoSettleReceivables: (customer_id: number) => {
    return apiRequest<{ message: string }>(`${SETTLEMENT_API}/auto-settle/receivables`, {
      method: 'POST',
      params: { customer_id },
    });
  },

  getStatement: (partner_id: number, partner_type: string, start_date: string, end_date: string) => {
    return apiRequest<any>(`${SETTLEMENT_API}/partner-statement`, {
      method: 'GET',
      params: { partner_id, partner_type, start_date, end_date },
    });
  },

  archiveStatement: (partner_id: number, partner_type: string, period: string) => {
    return apiRequest<PartnerStatement>(`${SETTLEMENT_API}/archive-statement`, {
      method: 'POST',
      params: { partner_id, partner_type, period },
    });
  },
};
