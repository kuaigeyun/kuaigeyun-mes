/**
 * 来料检验、过程检验、成品检验、质量统计等质量管理执行 API
 */

import { apiRequest } from '../../../services/api';

export const qualityApi = {
  incomingInspection: {
    list: async (params?: any) => apiRequest('/apps/kuaizhizao/incoming-inspections', { method: 'GET', params }),
    create: async (data: any) => apiRequest('/apps/kuaizhizao/incoming-inspections', { method: 'POST', data }),
    update: async (id: string, data: any) => apiRequest(`/apps/kuaizhizao/incoming-inspections/${id}`, { method: 'PUT', data }),
    delete: async (id: string) => apiRequest(`/apps/kuaizhizao/incoming-inspections/${id}`, { method: 'DELETE' }),
    get: async (id: string) => apiRequest(`/apps/kuaizhizao/incoming-inspections/${id}`, { method: 'GET' }),
    conduct: async (id: string, data: any) =>
      apiRequest(`/apps/kuaizhizao/incoming-inspections/${id}/conduct`, { method: 'POST', data }),
    approve: async (id: string, data: any) =>
      apiRequest(`/apps/kuaizhizao/incoming-inspections/${id}/approve`, { method: 'POST', data }),
    createFromPurchaseReceipt: async (purchaseReceiptId: string) =>
      apiRequest(`/apps/kuaizhizao/incoming-inspections/from-purchase-receipt/${purchaseReceiptId}`, { method: 'POST' }),
    createDefect: async (inspectionId: string, data: any) =>
      apiRequest(`/apps/kuaizhizao/incoming-inspections/${inspectionId}/create-defect`, { method: 'POST', data }),
    import: async (data: any[][]) =>
      apiRequest('/apps/kuaizhizao/incoming-inspections/import', { method: 'POST', data: { data } }),
    export: async (params?: any) =>
      apiRequest('/apps/kuaizhizao/incoming-inspections/export', { method: 'GET', params, responseType: 'blob' }),
  },
  processInspection: {
    list: async (params?: any) => apiRequest('/apps/kuaizhizao/process-inspections', { method: 'GET', params }),
    create: async (data: any) => apiRequest('/apps/kuaizhizao/process-inspections', { method: 'POST', data }),
    update: async (id: string, data: any) => apiRequest(`/apps/kuaizhizao/process-inspections/${id}`, { method: 'PUT', data }),
    delete: async (id: string) => apiRequest(`/apps/kuaizhizao/process-inspections/${id}`, { method: 'DELETE' }),
    get: async (id: string) => apiRequest(`/apps/kuaizhizao/process-inspections/${id}`, { method: 'GET' }),
    conduct: async (id: string, data: any) =>
      apiRequest(`/apps/kuaizhizao/process-inspections/${id}/conduct`, { method: 'POST', data }),
    approve: async (id: string, data: any) =>
      apiRequest(`/apps/kuaizhizao/process-inspections/${id}/approve`, { method: 'POST', data }),
    createFromWorkOrder: async (workOrderId: string, operationId: string) =>
      apiRequest(
        `/apps/kuaizhizao/process-inspections/from-work-order?work_order_id=${workOrderId}&operation_id=${operationId}`,
        { method: 'POST' }
      ),
    createDefect: async (inspectionId: string, data: any) =>
      apiRequest(`/apps/kuaizhizao/process-inspections/${inspectionId}/create-defect`, { method: 'POST', data }),
    import: async (data: any[][]) =>
      apiRequest('/apps/kuaizhizao/process-inspections/import', { method: 'POST', data: { data } }),
    export: async (params?: any) =>
      apiRequest('/apps/kuaizhizao/process-inspections/export', { method: 'GET', params, responseType: 'blob' }),
  },
  finishedGoodsInspection: {
    list: async (params?: any) => apiRequest('/apps/kuaizhizao/finished-goods-inspections', { method: 'GET', params }),
    create: async (data: any) => apiRequest('/apps/kuaizhizao/finished-goods-inspections', { method: 'POST', data }),
    update: async (id: string, data: any) =>
      apiRequest(`/apps/kuaizhizao/finished-goods-inspections/${id}`, { method: 'PUT', data }),
    delete: async (id: string) => apiRequest(`/apps/kuaizhizao/finished-goods-inspections/${id}`, { method: 'DELETE' }),
    get: async (id: string) => apiRequest(`/apps/kuaizhizao/finished-goods-inspections/${id}`, { method: 'GET' }),
    conduct: async (id: string, data: any) =>
      apiRequest(`/apps/kuaizhizao/finished-goods-inspections/${id}/conduct`, { method: 'POST', data }),
    approve: async (id: string, data: any) =>
      apiRequest(`/apps/kuaizhizao/finished-goods-inspections/${id}/approve`, { method: 'POST', data }),
    certificate: async (id: string, data: any) =>
      apiRequest(`/apps/kuaizhizao/finished-goods-inspections/${id}/certificate`, { method: 'POST', data }),
    createFromWorkOrder: async (workOrderId: string) =>
      apiRequest(
        `/apps/kuaizhizao/finished-goods-inspections/from-work-order?work_order_id=${workOrderId}`,
        { method: 'POST' }
      ),
    createDefect: async (inspectionId: string, data: any) =>
      apiRequest(`/apps/kuaizhizao/finished-goods-inspections/${inspectionId}/create-defect`, { method: 'POST', data }),
    import: async (data: any[][]) =>
      apiRequest('/apps/kuaizhizao/finished-goods-inspections/import', { method: 'POST', data: { data } }),
    export: async (params?: any) =>
      apiRequest('/apps/kuaizhizao/finished-goods-inspections/export', {
        method: 'GET',
        params,
        responseType: 'blob',
      }),
  },
  qualityStatistics: {
    getStatistics: async (params?: any) => apiRequest('/apps/kuaizhizao/quality/statistics', { method: 'GET', params }),
    getAnomalies: async (params?: any) => apiRequest('/apps/kuaizhizao/quality/anomalies', { method: 'GET', params }),
    getReport: async (params?: any) => apiRequest('/apps/kuaizhizao/reports/quality', { method: 'GET', params }),
  },
};

/** 质检方案 API */
export const inspectionPlanApi = {
  list: async (params?: any) => apiRequest('/apps/kuaizhizao/inspection-plans', { method: 'GET', params }),
  create: async (data: any) => apiRequest('/apps/kuaizhizao/inspection-plans', { method: 'POST', data }),
  update: async (id: string, data: any) => apiRequest(`/apps/kuaizhizao/inspection-plans/${id}`, { method: 'PUT', data }),
  delete: async (id: string) => apiRequest(`/apps/kuaizhizao/inspection-plans/${id}`, { method: 'DELETE' }),
  get: async (id: string) => apiRequest(`/apps/kuaizhizao/inspection-plans/${id}`, { method: 'GET' }),
  getByMaterial: async (materialId: string, params?: any) =>
    apiRequest(`/apps/kuaizhizao/inspection-plans/by-material/${materialId}`, { method: 'GET', params }),
};
