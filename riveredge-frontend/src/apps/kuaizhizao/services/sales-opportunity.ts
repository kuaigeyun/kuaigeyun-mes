/**
 * 销售商机 API
 */

import { apiRequest } from '../../../services/api';

export interface SalesOpportunity {
  id: number;
  uuid?: string;
  tenant_id?: number;
  customer_id: number;
  customer_name: string;
  title: string;
  stage_code: string;
  status: 'open' | 'won' | 'lost' | string;
  expected_amount?: string | number | null;
  expected_close_date?: string | null;
  owner_id?: number | null;
  quotation_id?: number | null;
  quotation_code?: string | null;
  sales_order_id?: number | null;
  sales_order_code?: string | null;
  last_follow_up_at?: string | null;
  next_follow_up_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SalesOpportunityListResult {
  items: SalesOpportunity[];
  total: number;
}

export const salesOpportunityApi = {
  list: async (params?: {
    skip?: number;
    limit?: number;
    customer_id?: number;
    status?: string;
  }): Promise<SalesOpportunityListResult> =>
    apiRequest('/apps/kuaizhizao/sales-opportunities', { method: 'GET', params }),

  get: async (id: number): Promise<SalesOpportunity> =>
    apiRequest(`/apps/kuaizhizao/sales-opportunities/${id}`, { method: 'GET' }),

  create: async (data: {
    customer_id: number;
    title: string;
    stage_code?: string;
    expected_amount?: number | null;
    expected_close_date?: string | null;
    quotation_id?: number | null;
    sales_order_id?: number | null;
  }): Promise<SalesOpportunity> =>
    apiRequest('/apps/kuaizhizao/sales-opportunities', { method: 'POST', data }),

  ensure: async (data: {
    customer_id: number;
    quotation_id?: number | null;
    sales_order_id?: number | null;
    title?: string | null;
  }): Promise<SalesOpportunity> =>
    apiRequest('/apps/kuaizhizao/sales-opportunities/ensure', { method: 'POST', data }),

  update: async (
    id: number,
    data: Partial<{
      title: string;
      stage_code: string;
      expected_amount: number | null;
      expected_close_date: string | null;
      quotation_id: number | null;
      sales_order_id: number | null;
      next_follow_up_at: string | null;
    }>
  ): Promise<SalesOpportunity> =>
    apiRequest(`/apps/kuaizhizao/sales-opportunities/${id}`, { method: 'PATCH', data }),
};
