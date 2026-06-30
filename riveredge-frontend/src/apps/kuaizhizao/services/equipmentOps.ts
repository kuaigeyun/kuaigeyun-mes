/**
 * 设备运营 API：点检/巡检/保养主数据、单据、方案绑定
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

export const inspectionItemsApi = crudApi('equipment-inspection-items');
export const inspectionSchemesApi = crudApi('equipment-inspection-schemes');
export const patrolRoutesApi = crudApi('equipment-patrol-routes');
export const maintenanceItemsApi = crudApi('equipment-maintenance-items');
export const maintenanceSchemesApi = crudApi('equipment-maintenance-schemes');

export const schemeBindingsApi = {
  list: (params: { equipment_id: number; scheme_type?: string }) =>
    apiRequest(`${BASE}/equipment-scheme-bindings`, { method: 'GET', params }),
  bulkReplace: (data: { equipment_id: number; scheme_type?: string; scheme_ids: number[] }) =>
    apiRequest(`${BASE}/equipment-scheme-bindings/bulk-replace`, { method: 'PUT', data }),
};

export const spotChecksApi = {
  ...crudApi('equipment-spot-checks'),
  previewLines: (params: { equipment_id: number; scheme_id?: number }) =>
    apiRequest(`${BASE}/equipment-spot-checks/preview-lines`, { method: 'GET', params }),
};

export const routePatrolsApi = {
  ...crudApi('equipment-route-patrols'),
  previewLines: (params: { route_id: number }) =>
    apiRequest(`${BASE}/equipment-route-patrols/preview-lines`, { method: 'GET', params }),
};

export const scrapApplicationsApi = {
  ...crudApi('equipment-scrap-applications'),
  submit: (id: number) =>
    apiRequest(`${BASE}/equipment-scrap-applications/${id}/submit`, { method: 'POST' }),
  approve: (id: number) =>
    apiRequest(`${BASE}/equipment-scrap-applications/${id}/approve`, { method: 'POST' }),
  reject: (id: number, data: { reject_reason: string }) =>
    apiRequest(`${BASE}/equipment-scrap-applications/${id}/reject`, { method: 'POST', data }),
};

export const sparePartRequisitionsApi = {
  ...crudApi('spare-part-requisitions'),
  submit: (id: number) => apiRequest(`${BASE}/spare-part-requisitions/${id}/submit`, { method: 'POST' }),
  approve: (id: number) => apiRequest(`${BASE}/spare-part-requisitions/${id}/approve`, { method: 'POST' }),
  reject: (id: number, data: { reject_reason: string }) =>
    apiRequest(`${BASE}/spare-part-requisitions/${id}/reject`, { method: 'POST', data }),
};

export const transferApplicationsApi = {
  ...crudApi('equipment-transfers'),
  submit: (id: number) => apiRequest(`${BASE}/equipment-transfers/${id}/submit`, { method: 'POST' }),
  approve: (id: number) => apiRequest(`${BASE}/equipment-transfers/${id}/approve`, { method: 'POST' }),
  reject: (id: number, data: { reject_reason: string }) =>
    apiRequest(`${BASE}/equipment-transfers/${id}/reject`, { method: 'POST', data }),
};
