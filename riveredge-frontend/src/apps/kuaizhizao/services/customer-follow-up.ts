/**
 * 客户跟进（销售极简 CRM）API
 */

import { apiRequest } from '../../../services/api';

export interface CustomerFollowUp {
  id: number;
  uuid?: string;
  tenant_id?: number;
  customer_id: number;
  customer_name: string;
  activity_type_code: string;
  content: string;
  occurred_at: string;
  next_follow_up_at?: string | null;
  quotation_id?: number | null;
  quotation_code?: string | null;
  sales_order_id?: number | null;
  sales_order_code?: string | null;
  opportunity_id?: number | null;
  stage_code_before?: string | null;
  stage_code_after?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by?: number | null;
  updated_by?: number | null;
  created_by_name?: string | null;
}

export interface CustomerFollowUpListResult {
  items: CustomerFollowUp[];
  total: number;
}

export interface CustomerFollowUpListParams {
  skip?: number;
  limit?: number;
  customer_id?: number;
  keyword?: string;
  occurred_from?: string;
  occurred_to?: string;
  pending_only?: boolean;
}

export const customerFollowUpApi = {
  list: async (params?: CustomerFollowUpListParams): Promise<CustomerFollowUpListResult> =>
    apiRequest('/apps/kuaizhizao/customer-follow-ups', { method: 'GET', params }),

  get: async (id: number): Promise<CustomerFollowUp> =>
    apiRequest(`/apps/kuaizhizao/customer-follow-ups/${id}`, { method: 'GET' }),

  create: async (data: {
    customer_id: number;
    activity_type_code: string;
    content: string;
    occurred_at: string;
    next_follow_up_at?: string | null;
    quotation_id?: number | null;
    sales_order_id?: number | null;
    opportunity_id?: number | null;
    stage_code_after?: string | null;
  }): Promise<CustomerFollowUp> =>
    apiRequest('/apps/kuaizhizao/customer-follow-ups', { method: 'POST', data }),

  update: async (
    id: number,
    data: Partial<{
      customer_name: string;
      activity_type_code: string;
      content: string;
      occurred_at: string;
      next_follow_up_at: string | null;
      quotation_id: number | null;
      sales_order_id: number | null;
      opportunity_id?: number | null;
      stage_code_after?: string | null;
    }>
  ): Promise<CustomerFollowUp> =>
    apiRequest(`/apps/kuaizhizao/customer-follow-ups/${id}`, { method: 'PUT', data }),

  delete: async (id: number): Promise<void> =>
    apiRequest(`/apps/kuaizhizao/customer-follow-ups/${id}`, { method: 'DELETE' }),
};
