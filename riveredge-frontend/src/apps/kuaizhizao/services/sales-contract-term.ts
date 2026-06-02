/**
 * 销售合同条款 API
 */

import { apiRequest } from '../../../services/api';

export interface SalesContractTermItem {
  id?: number;
  uuid?: string;
  term_code?: string;
  term_name: string;
  content: string;
  sort_order?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface SalesContractTermGroupItemRef {
  term_item_id: number;
  sort_order?: number;
}

export interface SalesContractTermGroupItemDetail extends SalesContractTermGroupItemRef {
  term_code?: string;
  term_name: string;
  content: string;
}

export interface SalesContractTermGroup {
  id?: number;
  uuid?: string;
  group_code?: string;
  group_name: string;
  description?: string;
  is_active?: boolean;
  items?: SalesContractTermGroupItemDetail[];
  created_at?: string;
  updated_at?: string;
}

export interface SalesContractTermSnapshot {
  term_item_id?: number;
  term_name: string;
  content: string;
  template_content?: string;
  placeholder_values?: Record<string, string>;
  sort_order?: number;
}

const BASE = '/apps/kuaizhizao/sales-contracts';

export const salesContractTermApi = {
  listItems: (params?: Record<string, unknown>) =>
    apiRequest<{ items: SalesContractTermItem[]; total: number }>(`${BASE}/term-items`, { params }),

  getItem: (id: number) => apiRequest<SalesContractTermItem>(`${BASE}/term-items/${id}`),

  createItem: (data: Partial<SalesContractTermItem>) =>
    apiRequest<SalesContractTermItem>(`${BASE}/term-items`, { method: 'POST', data }),

  updateItem: (id: number, data: Partial<SalesContractTermItem>) =>
    apiRequest<SalesContractTermItem>(`${BASE}/term-items/${id}`, { method: 'PUT', data }),

  deleteItem: (id: number) =>
    apiRequest<{ success: boolean }>(`${BASE}/term-items/${id}`, { method: 'DELETE' }),

  listGroups: (params?: Record<string, unknown>) =>
    apiRequest<{ items: SalesContractTermGroup[]; total: number }>(`${BASE}/term-groups`, { params }),

  getGroup: (id: number) => apiRequest<SalesContractTermGroup>(`${BASE}/term-groups/${id}`),

  createGroup: (data: Partial<SalesContractTermGroup> & { items?: SalesContractTermGroupItemRef[] }) =>
    apiRequest<SalesContractTermGroup>(`${BASE}/term-groups`, { method: 'POST', data }),

  updateGroup: (
    id: number,
    data: Partial<SalesContractTermGroup> & { items?: SalesContractTermGroupItemRef[] },
  ) => apiRequest<SalesContractTermGroup>(`${BASE}/term-groups/${id}`, { method: 'PUT', data }),

  deleteGroup: (id: number) =>
    apiRequest<{ success: boolean }>(`${BASE}/term-groups/${id}`, { method: 'DELETE' }),
};
