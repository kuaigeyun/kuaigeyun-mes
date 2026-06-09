import { apiRequest } from '../../../services/api';

export interface CustomerPoolItem {
  id: number;
  uuid: string;
  code: string;
  name: string;
  short_name?: string | null;
  contact_person?: string | null;
  phone?: string | null;
  salesman_id?: number | null;
  salesman_name?: string | null;
  pool_status: 'pool' | 'owned';
  assigned_at?: string | null;
  last_follow_up_at?: string | null;
  recycle_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerPoolListResult {
  items: CustomerPoolItem[];
  total: number;
}

export interface CustomerPoolRule {
  recycle_enabled: boolean;
  recycle_after_days: number;
  max_owned_customers: number;
  allow_claim_others: boolean;
  updated_at?: string | null;
  updated_by?: number | null;
}

export const customerPoolApi = {
  list: async (params?: {
    scope?: 'pool' | 'mine' | 'all';
    skip?: number;
    limit?: number;
    keyword?: string;
    salesmanId?: number;
    poolStatus?: 'pool' | 'owned';
  }): Promise<CustomerPoolListResult> =>
    apiRequest('/apps/kuaizhizao/customer-pool', { method: 'GET', params }),

  claim: async (customerId: number, reason?: string): Promise<CustomerPoolItem> =>
    apiRequest(`/apps/kuaizhizao/customer-pool/${customerId}/claim`, {
      method: 'POST',
      data: { reason },
    }),

  assign: async (customerId: number, salesmanId: number, reason?: string): Promise<CustomerPoolItem> =>
    apiRequest(`/apps/kuaizhizao/customer-pool/${customerId}/assign`, {
      method: 'POST',
      data: { salesman_id: salesmanId, reason },
    }),

  release: async (customerId: number, reason?: string): Promise<CustomerPoolItem> =>
    apiRequest(`/apps/kuaizhizao/customer-pool/${customerId}/release`, {
      method: 'POST',
      data: { reason },
    }),

  recycle: async (customerId: number, reason?: string): Promise<CustomerPoolItem> =>
    apiRequest(`/apps/kuaizhizao/customer-pool/${customerId}/recycle`, {
      method: 'POST',
      data: { reason },
    }),

  getRules: async (): Promise<CustomerPoolRule> =>
    apiRequest('/apps/kuaizhizao/customer-pool/rules', { method: 'GET' }),

  updateRules: async (data: Partial<CustomerPoolRule>): Promise<CustomerPoolRule> =>
    apiRequest('/apps/kuaizhizao/customer-pool/rules', { method: 'PUT', data }),
};

