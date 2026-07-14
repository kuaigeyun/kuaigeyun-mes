import { apiRequest } from '../../../../services/api';

export interface StandardCost {
  id: number;
  tenant_id: number;
  target_type: string;
  target_id: number;
  target_code?: string;
  target_name?: string;
  cost_item_type: string;
  standard_value: number;
  currency: string;
  unit?: string;
  version: string;
  effective_date?: string;
  expiry_date?: string;
  is_active: boolean;
  description?: string;
  created_at: string;
  updated_at: string;
  created_by_name?: string;
  updated_by_name?: string;
}

export interface StandardCostListParams {
  skip?: number;
  limit?: number;
  target_type?: string;
  target_id?: number;
  cost_item_type?: string;
  is_active?: boolean;
  keyword?: string;
  target_code?: string;
  target_name?: string;
  effective_date_start?: string;
  effective_date_end?: string;
  created_start_date?: string;
  created_end_date?: string;
  updated_start_date?: string;
  updated_end_date?: string;
  sort_field?: string;
  sort_order?: string;
  search?: string;
}

const API = '/apps/kuaicaiwu/cost/standard-costs';

export const standardCostService = {
  list: (params?: StandardCostListParams) =>
    apiRequest<{ items: StandardCost[]; total: number; skip: number; limit: number }>(API, {
      method: 'GET',
      params,
    }),

  get: (id: number) =>
    apiRequest<StandardCost>(`${API}/${id}`, { method: 'GET' }),

  create: (data: Partial<StandardCost>) =>
    apiRequest<StandardCost>(API, { method: 'POST', data }),

  update: (id: number, data: Partial<StandardCost>) =>
    apiRequest<StandardCost>(`${API}/${id}`, { method: 'PUT', data }),

  delete: (id: number) =>
    apiRequest<void>(`${API}/${id}`, { method: 'DELETE' }),
};
