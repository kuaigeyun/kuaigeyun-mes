import { apiRequest } from '../../../../services/api';

const API = '/apps/kuaicaiwu/price-settlement';

export interface PriceSettlementCandidate {
  side: string;
  source_order_id: number;
  source_order_code: string;
  source_line_id: number;
  partner_id: number;
  partner_name: string;
  material_id: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  material_model?: string;
  material_unit?: string;
  order_quantity: number;
  settled_quantity: number;
  before_unit_price: number;
  provisional_unit_price?: number;
  suggested_unit_price?: number;
  after_unit_price?: number;
  order_date?: string;
}

export interface PriceSettlementLineInput {
  source_line_id: number;
  after_unit_price: number;
}

export interface PriceSettlementBatchCreatePayload {
  period: string;
  side: 'sales' | 'purchase';
  partner_id: number;
  price_source?: string;
  notes?: string;
  lines: PriceSettlementLineInput[];
}

export interface PriceSettlementLine {
  id: number;
  source_order_id: number;
  source_order_code: string;
  source_line_id: number;
  material_id: number;
  material_code?: string;
  material_name?: string;
  settled_quantity: number;
  before_unit_price: number;
  after_unit_price: number;
  delta_amount: number;
  finance_adjustment_id?: number;
  finance_adjustment_type?: string;
}

export interface PriceSettlementBatch {
  id: number;
  batch_code: string;
  period: string;
  side: string;
  partner_id: number;
  partner_name: string;
  status: string;
  price_source: string;
  total_delta_amount: number;
  notes?: string;
  applied_at?: string;
  applied_by_name?: string;
  lines: PriceSettlementLine[];
  created_at: string;
  updated_at: string;
}

export interface PriceSettlementApplyResult {
  batch: PriceSettlementBatch;
  receivable_ids: number[];
  payable_ids: number[];
}

export interface ProvisionalSummary {
  side: string;
  partner_id: number;
  partner_name: string;
  provisional_line_count: number;
  period: string;
}

export const priceSettlementService = {
  listCandidates(params: {
    period: string;
    side: 'sales' | 'purchase';
    partner_id: number;
    price_source?: string;
  }) {
    return apiRequest<PriceSettlementCandidate[]>(`${API}/candidates`, { params });
  },

  getProvisionalSummary(params: {
    period: string;
    side: 'sales' | 'purchase';
    partner_id: number;
  }) {
    return apiRequest<ProvisionalSummary>(`${API}/provisional-summary`, { params });
  },

  createBatch(payload: PriceSettlementBatchCreatePayload) {
    return apiRequest<PriceSettlementBatch>(`${API}/batches`, {
      method: 'POST',
      body: payload,
    });
  },

  getBatch(batchId: number) {
    return apiRequest<PriceSettlementBatch>(`${API}/batches/${batchId}`);
  },

  applyBatch(batchId: number) {
    return apiRequest<PriceSettlementApplyResult>(`${API}/batches/${batchId}/apply`, {
      method: 'POST',
    });
  },
};
