/**
 * 模具运营 API：保养/维修主数据、方案绑定、试模、领用/归还、保养/维修单据、报表
 */

import { apiRequest } from '../../../services/api';

const BASE = '/apps/kuaizhizao';

function crudApi(basePath: string) {
  return {
    list: (params?: Record<string, unknown>) =>
      apiRequest(`${BASE}/${basePath}`, { method: 'GET', params }),
    get: (id: number) => apiRequest(`${BASE}/${basePath}/${id}`, { method: 'GET' }),
    create: (data: unknown) => apiRequest(`${BASE}/${basePath}`, { method: 'POST', data }),
    update: (id: number, data: unknown) =>
      apiRequest(`${BASE}/${basePath}/${id}`, { method: 'PUT', data }),
    delete: (id: number) => apiRequest(`${BASE}/${basePath}/${id}`, { method: 'DELETE' }),
  };
}

function workflowDocApi(basePath: string) {
  return {
    ...crudApi(basePath),
    previewLines: (params: { mold_id: number; scheme_id?: number }) =>
      apiRequest(`${BASE}/${basePath}/preview-lines`, { method: 'GET', params }),
    submit: (id: number) => apiRequest(`${BASE}/${basePath}/${id}/submit`, { method: 'POST' }),
    approve: (id: number) => apiRequest(`${BASE}/${basePath}/${id}/approve`, { method: 'POST' }),
    reject: (id: number, data: { reject_reason: string }) =>
      apiRequest(`${BASE}/${basePath}/${id}/reject`, { method: 'POST', data }),
    complete: (id: number, data?: unknown) =>
      apiRequest(`${BASE}/${basePath}/${id}/complete`, { method: 'POST', data }),
  };
}

export const maintenanceItemsApi = crudApi('mold-maintenance-items');
export const maintenanceSchemesApi = crudApi('mold-maintenance-schemes');
export const repairItemsApi = crudApi('mold-repair-items');
export const repairSchemesApi = crudApi('mold-repair-schemes');

export const schemeBindingsApi = {
  list: (params: { mold_id: number; scheme_type?: string }) =>
    apiRequest(`${BASE}/mold-scheme-bindings`, { method: 'GET', params }),
  bulkReplace: (data: { mold_id: number; scheme_type: string; scheme_ids: number[] }) =>
    apiRequest(`${BASE}/mold-scheme-bindings/bulk-replace`, { method: 'PUT', data }),
};

export const trialsApi = crudApi('mold-trials');

export const borrowsApi = {
  ...crudApi('mold-borrows'),
  listOutstanding: (params?: Record<string, unknown>) =>
    apiRequest(`${BASE}/mold-borrows/outstanding`, { method: 'GET', params }),
};

export const returnsApi = crudApi('mold-returns');

export const maintenancesApi = workflowDocApi('mold-maintenances');
export const repairsApi = workflowDocApi('mold-repairs');

export const scrapApplicationsApi = {
  ...crudApi('mold-scrap-applications'),
  submit: (id: number) => apiRequest(`${BASE}/mold-scrap-applications/${id}/submit`, { method: 'POST' }),
  approve: (id: number) => apiRequest(`${BASE}/mold-scrap-applications/${id}/approve`, { method: 'POST' }),
  reject: (id: number, data: { reject_reason: string }) =>
    apiRequest(`${BASE}/mold-scrap-applications/${id}/reject`, { method: 'POST', data }),
};

export const moldReportsApi = {
  trialRecords: (params?: Record<string, unknown>) =>
    apiRequest(`${BASE}/reports/mold-trial-records`, { method: 'GET', params }),
  maintenanceAlerts: (params?: Record<string, unknown>) =>
    apiRequest(`${BASE}/reports/mold-maintenance-alerts`, { method: 'GET', params }),
  borrowReturnLog: (params?: Record<string, unknown>) =>
    apiRequest(`${BASE}/reports/mold-borrow-return-log`, { method: 'GET', params }),
  repairAnalysis: (params?: Record<string, unknown>) =>
    apiRequest(`${BASE}/reports/mold-repair-analysis`, { method: 'GET', params }),
};
