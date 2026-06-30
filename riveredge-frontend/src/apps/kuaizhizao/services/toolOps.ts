/**
 * 工装运营 API：保养/维修主数据、方案绑定、领用/归还、保养/维修/报废单据、校准、报表
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
    previewLines: (params: { tool_id: number; scheme_id?: number }) =>
      apiRequest(`${BASE}/${basePath}/preview-lines`, { method: 'GET', params }),
    submit: (id: number) => apiRequest(`${BASE}/${basePath}/${id}/submit`, { method: 'POST' }),
    approve: (id: number) => apiRequest(`${BASE}/${basePath}/${id}/approve`, { method: 'POST' }),
    reject: (id: number, data: { reject_reason: string }) =>
      apiRequest(`${BASE}/${basePath}/${id}/reject`, { method: 'POST', data }),
    complete: (id: number, data?: unknown) =>
      apiRequest(`${BASE}/${basePath}/${id}/complete`, { method: 'POST', data }),
  };
}

export const maintenanceItemsApi = crudApi('tool-maintenance-items');
export const maintenanceSchemesApi = crudApi('tool-maintenance-schemes');
export const repairItemsApi = crudApi('tool-repair-items');
export const repairSchemesApi = crudApi('tool-repair-schemes');

export const schemeBindingsApi = {
  list: (params: { tool_id: number; scheme_type?: string }) =>
    apiRequest(`${BASE}/tool-scheme-bindings`, { method: 'GET', params }),
  bulkReplace: (data: { tool_id: number; scheme_type: string; scheme_ids: number[] }) =>
    apiRequest(`${BASE}/tool-scheme-bindings/bulk-replace`, { method: 'PUT', data }),
};

export const borrowsApi = {
  ...crudApi('tool-borrows'),
  listOutstanding: (params?: Record<string, unknown>) =>
    apiRequest(`${BASE}/tool-borrows/outstanding`, { method: 'GET', params }),
};

export const returnsApi = crudApi('tool-returns');

export const maintenancesApi = workflowDocApi('tool-maintenances');
export const repairsApi = workflowDocApi('tool-repairs');

export const scrapApplicationsApi = {
  ...crudApi('tool-scrap-applications'),
  submit: (id: number) => apiRequest(`${BASE}/tool-scrap-applications/${id}/submit`, { method: 'POST' }),
  approve: (id: number) => apiRequest(`${BASE}/tool-scrap-applications/${id}/approve`, { method: 'POST' }),
  reject: (id: number, data: { reject_reason: string }) =>
    apiRequest(`${BASE}/tool-scrap-applications/${id}/reject`, { method: 'POST', data }),
};

export const calibrationsApi = {
  list: (params?: Record<string, unknown>) =>
    apiRequest(`${BASE}/tool-calibrations`, { method: 'GET', params }),
  create: (data: unknown) => apiRequest(`${BASE}/tool-calibrations`, { method: 'POST', data }),
};

export const toolReportsApi = {
  maintenanceAlerts: (params?: Record<string, unknown>) =>
    apiRequest(`${BASE}/reports/tool-maintenance-alerts`, { method: 'GET', params }),
  calibrationAlerts: (params?: Record<string, unknown>) =>
    apiRequest(`${BASE}/reports/tool-calibration-alerts`, { method: 'GET', params }),
  borrowReturnLog: (params?: Record<string, unknown>) =>
    apiRequest(`${BASE}/reports/tool-borrow-return-log`, { method: 'GET', params }),
  repairAnalysis: (params?: Record<string, unknown>) =>
    apiRequest(`${BASE}/reports/tool-repair-analysis`, { method: 'GET', params }),
};
