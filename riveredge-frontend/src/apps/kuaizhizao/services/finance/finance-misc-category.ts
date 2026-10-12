import { apiRequest } from '../../../../services/api';

export type MiscCategoryKind = 'income' | 'expense';

export interface MiscCategory {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
  default_gl_account_code?: string | null;
  sort_order?: number;
}

const base = '/apps/kuaicaiwu/finance-misc-categories';

export const financeMiscCategoryService = {
  list: (
    kind: MiscCategoryKind,
    params?: { keyword?: string; is_active?: boolean; ensure_defaults?: boolean },
  ) =>
    apiRequest<MiscCategory[]>(`${base}/${kind}`, { method: 'GET', params }),

  createQuick: (kind: MiscCategoryKind, name: string) =>
    apiRequest<MiscCategory>(`${base}/${kind}`, { method: 'POST', data: { name: name.trim() } }),

  create: (kind: MiscCategoryKind, data: Partial<MiscCategory>) =>
    apiRequest(`${base}/${kind}`, { method: 'POST', data }),

  update: (kind: MiscCategoryKind, id: number, data: Partial<MiscCategory>) =>
    apiRequest(`${base}/${kind}/${id}`, { method: 'PUT', data }),

  delete: (kind: MiscCategoryKind, id: number) =>
    apiRequest(`${base}/${kind}/${id}`, { method: 'DELETE' }),
};
