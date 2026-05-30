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
}

export interface StandardCostListParams {
  skip?: number;
  limit?: number;
  target_type?: string;
  target_id?: number;
  cost_item_type?: string;
  is_active?: boolean;
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
