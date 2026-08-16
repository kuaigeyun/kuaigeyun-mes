/**
 * 订单评审 API
 */

import { apiRequest } from '../../../services/api';

export type SalesReviewStatus =
  | 'draft'
  | 'reviewing'
  | 'rejected'
  | 'passed'
  | 'closed'
  | 'cancelled';

export type SalesReviewDeptCode = 'tech' | 'process' | 'purchase' | 'production' | 'quality';

export interface SalesReviewItem {
  id?: number;
  sales_review_id?: number;
  line_no?: number;
  material_id?: number | null;
  material_code: string;
  material_name: string;
  material_spec?: string | null;
  material_unit?: string | null;
  quantity: number | string;
  unit_price?: number | string;
  amount?: number | string | null;
  tech_requirements?: string | null;
  notes?: string | null;
}

export interface SalesReviewDeptOpinion {
  id: number;
  sales_review_id: number;
  review_round: number;
  dept_code: string;
  result: string;
  opinion?: string | null;
  reviewed_by?: number | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
}

export interface SalesReview {
  id: number;
  uuid?: string;
  tenant_id?: number;
  review_code: string;
  status: SalesReviewStatus | string;
  review_round: number;
  customer_id: number;
  customer_code?: string | null;
  customer_name: string;
  customer_contact?: string | null;
  customer_phone?: string | null;
  project_name: string;
  review_date?: string | null;
  delivery_date?: string | null;
  urgency: string;
  risk_level: string;
  settlement_method?: string | null;
  payment_cycle?: string | null;
  delivery_location?: string | null;
  transport_method?: string | null;
  material_desc?: string | null;
  spec_desc?: string | null;
  process_desc?: string | null;
  packaging_req?: string | null;
  production_notes?: string | null;
  sales_opinion?: string | null;
  final_conclusion?: string | null;
  remarks?: string | null;
  attachments?: unknown[] | null;
  quotation_id?: number | null;
  quotation_code?: string | null;
  customer_follow_up_id?: number | null;
  salesman_id?: number | null;
  salesman_name?: string | null;
  sales_order_id?: number | null;
  sales_order_code?: string | null;
  total_quantity?: number | string;
  total_amount?: number | string;
  items?: SalesReviewItem[];
  dept_opinions?: SalesReviewDeptOpinion[];
  created_at?: string;
  updated_at?: string;
  created_by?: number | null;
  updated_by?: number | null;
  created_by_name?: string | null;
  updated_by_name?: string | null;
}

export interface SalesReviewListItem {
  id: number;
  review_code: string;
  customer_id: number;
  customer_name: string;
  project_name: string;
  status: string;
  review_round: number;
  urgency: string;
  risk_level: string;
  delivery_date?: string | null;
  review_date?: string | null;
  total_quantity?: number | string;
  total_amount?: number | string;
  salesman_name?: string | null;
  sales_order_code?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by?: number | null;
  created_by_name?: string | null;
  updated_by?: number | null;
  updated_by_name?: string | null;
}

export interface SalesReviewListResult {
  items: SalesReviewListItem[];
  total: number;
  skip?: number;
  limit?: number;
}

export interface SalesReviewListParams {
  skip?: number;
  limit?: number;
  status?: string;
  customer_id?: number;
  keyword?: string;
  order_by?: string;
  /** 仅可下推销售订单：评审已通过且未关联销售订单 */
  pullable_only?: boolean;
}

export interface SalesReviewItemInput {
  material_id?: number | null;
  material_code: string;
  material_name: string;
  material_spec?: string | null;
  material_unit?: string | null;
  quantity: number | string;
  unit_price?: number | string;
  tech_requirements?: string | null;
  notes?: string | null;
}

export interface SalesReviewCreatePayload {
  review_code?: string | null;
  customer_id: number;
  customer_code?: string | null;
  customer_name: string;
  customer_contact?: string | null;
  customer_phone?: string | null;
  project_name: string;
  review_date?: string | null;
  delivery_date?: string | null;
  urgency?: string;
  risk_level?: string;
  settlement_method?: string | null;
  payment_cycle?: string | null;
  delivery_location?: string | null;
  transport_method?: string | null;
  material_desc?: string | null;
  spec_desc?: string | null;
  process_desc?: string | null;
  packaging_req?: string | null;
  production_notes?: string | null;
  sales_opinion?: string | null;
  remarks?: string | null;
  quotation_id?: number | null;
  quotation_code?: string | null;
  customer_follow_up_id?: number | null;
  salesman_id?: number | null;
  salesman_name?: string | null;
  items: SalesReviewItemInput[];
}

export type SalesReviewUpdatePayload = Partial<Omit<SalesReviewCreatePayload, 'items'>> & {
  items?: SalesReviewItemInput[];
  final_conclusion?: string | null;
};

export interface SalesReviewDeptOpinionSubmit {
  result: 'pass' | 'fail';
  opinion?: string | null;
}

export interface SalesReviewPushPreview {
  can_push: boolean;
  blocking_reason?: string | null;
  review_code: string;
  customer_name: string;
  item_count: number;
  total_quantity: number | string;
  total_amount: number | string;
  items: Record<string, unknown>[];
}

export interface SalesReviewPushResult {
  success: boolean;
  message: string;
  sales_order_id?: number | null;
  sales_order_code?: string | null;
}

const BASE = '/apps/kuaizhizao/sales-reviews';

export const salesReviewApi = {
  list: async (params?: SalesReviewListParams): Promise<SalesReviewListResult> =>
    apiRequest(BASE, { method: 'GET', params }),

  get: async (id: number): Promise<SalesReview> =>
    apiRequest(`${BASE}/${id}`, { method: 'GET' }),

  create: async (data: SalesReviewCreatePayload): Promise<SalesReview> =>
    apiRequest(BASE, { method: 'POST', data }),

  update: async (id: number, data: SalesReviewUpdatePayload): Promise<SalesReview> =>
    apiRequest(`${BASE}/${id}`, { method: 'PUT', data }),

  remove: async (id: number): Promise<void> =>
    apiRequest(`${BASE}/${id}`, { method: 'DELETE' }),

  issue: async (id: number): Promise<SalesReview> =>
    apiRequest(`${BASE}/${id}/issue`, { method: 'POST' }),

  withdraw: async (id: number): Promise<SalesReview> =>
    apiRequest(`${BASE}/${id}/withdraw`, { method: 'POST' }),

  submitDeptOpinion: async (
    id: number,
    deptCode: string,
    data: SalesReviewDeptOpinionSubmit,
  ): Promise<SalesReview> =>
    apiRequest(`${BASE}/${id}/dept-opinions/${deptCode}`, { method: 'POST', data }),

  reject: async (id: number, reason?: string | null): Promise<SalesReview> =>
    apiRequest(`${BASE}/${id}/reject`, {
      method: 'POST',
      data: reason != null && String(reason).trim() ? { reason: String(reason).trim() } : {},
    }),

  previewPushToSalesOrder: async (id: number): Promise<SalesReviewPushPreview> =>
    apiRequest(`${BASE}/${id}/push-to-sales-order/preview`, { method: 'GET' }),

  pushToSalesOrder: async (id: number): Promise<SalesReviewPushResult> =>
    apiRequest(`${BASE}/${id}/push-to-sales-order`, { method: 'POST' }),

  pullFromQuotation: async (quotationId: number): Promise<{
    success: boolean;
    message?: string;
    sales_review?: SalesReview;
  }> =>
    apiRequest(`${BASE}/pull-from-quotation`, {
      method: 'POST',
      data: { quotation_id: quotationId },
    }),
};
