import { apiRequest } from '../../../../services/api';
import type { DocumentPushPreview } from '../../../kuaizhizao/services/purchase-requisition';
import { SettlementRecord } from '../../types/finance/settlement';

const SETTLEMENT_API = '/apps/kuaicaiwu/settlement';

export type SettlementPreview = DocumentPushPreview & {
  business_type?: 'receivable' | 'payable';
  max_settle_quantity?: number;
  receivable_id?: number;
  receipt_id?: number;
  payable_id?: number;
  payment_id?: number;
  receivable_code?: string;
  receipt_code?: string;
  payable_code?: string;
  payment_code?: string;
  customer_id?: number;
  customer_name?: string;
  supplier_id?: number;
  supplier_name?: string;
};

export type SettlementPreviewItem = {
  item_id: number;
  source_code: string;
  doc_type: string;
  partner_name?: string;
  quantity: number;
  pushed_quantity: number;
  max_push_quantity: number;
};

export const settlementService = {
  previewReceivableSettle: (receivable_id: number, receipt_id: number) =>
    apiRequest<SettlementPreview>(`${SETTLEMENT_API}/receivable/preview`, {
      method: 'GET',
      params: { receivable_id, receipt_id },
    }),

  previewPayableSettle: (payable_id: number, payment_id: number) =>
    apiRequest<SettlementPreview>(`${SETTLEMENT_API}/payable/preview`, {
      method: 'GET',
      params: { payable_id, payment_id },
    }),

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
};
