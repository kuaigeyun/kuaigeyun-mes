import { apiRequest } from '../../../services/api';

export interface CustomerPoolCollaboratorItem {
  user_id: number;
  user_name: string;
}

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
  created_by_name?: string | null;
  updated_by_name?: string | null;
  created_at: string;
  updated_at: string;
  collaborators?: CustomerPoolCollaboratorItem[];
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

export interface CustomerPoolLogItem {
  action: string;
  from_salesman_id?: number | null;
  from_salesman_name?: string | null;
  to_salesman_id?: number | null;
  to_salesman_name?: string | null;
  operator_user_id: number;
  operator_name?: string | null;
  reason?: string | null;
  created_at: string;
}

export interface CustomerPoolLogListResult {
  items: CustomerPoolLogItem[];
  total: number;
}

export interface CustomerPoolListParams {
  scope?: 'pool' | 'mine' | 'all';
  skip?: number;
  limit?: number;
  keyword?: string;
  code?: string;
  name?: string;
  contact_person?: string;
  phone?: string;
  salesmanId?: number;
  poolStatus?: 'pool' | 'owned';
  last_follow_up_from?: string;
  last_follow_up_to?: string;
  recycle_from?: string;
  recycle_to?: string;
  assigned_from?: string;
  assigned_to?: string;
  created_start_date?: string;
  created_end_date?: string;
  updated_start_date?: string;
  updated_end_date?: string;
  order_by?: string;
}

export const customerPoolApi = {
  list: async (params?: CustomerPoolListParams): Promise<CustomerPoolListResult> =>
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

  getCollaborators: async (customerId: number): Promise<CustomerPoolCollaboratorItem[]> =>
    apiRequest(`/apps/kuaizhizao/customer-pool/${customerId}/collaborators`, { method: 'GET' }),

  setCollaborators: async (customerId: number, userIds: number[]): Promise<CustomerPoolCollaboratorItem[]> =>
    apiRequest(`/apps/kuaizhizao/customer-pool/${customerId}/collaborators`, {
      method: 'PUT',
      data: { user_ids: userIds },
    }),

  getLogs: async (customerId: number): Promise<CustomerPoolLogListResult> =>
    apiRequest(`/apps/kuaizhizao/customer-pool/${customerId}/logs`, { method: 'GET' }),
};

