/**
 * 来料检验、过程检验、成品检验、质量统计等质量管理执行 API
 */

import { apiRequest } from '../../../services/api';

/** 检验统计（用于指标卡片） */
export interface InspectionStatistics {
  pending_count: number;
  qualified_count: number;
  unqualified_count: number;
  total_count: number;
}

/** 质检中心看板汇总 */
export interface InspectionCenterSummary {
  pending_incoming: number;
  pending_process: number;
  pending_finished: number;
  total_inspected_today: number;
  today_qualified_rate: number;
  month_qualified_rate: number;
  last_month_qualified_rate: number;
  daily_pass_rate_trend: { date: string; rate: number }[];
  sparkline_rates: number[];
}

/** 质量异常单条（与后端 /quality/anomalies 一致） */
export interface QualityAnomalyItem {
  inspection_type: string;
  inspection_id: number;
  inspection_code: string;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  nonconformance_reason?: string | null;
  inspection_time?: string | null;
  inspection_quantity?: number;
  unqualified_quantity?: number;
  supplier_name?: string;
  work_order_code?: string;
  operation_name?: string;
}

export interface QualityAnomaliesResponse {
  total: number;
  anomalies: QualityAnomalyItem[];
}

export const qualityApi = {
  incomingInspection: {
    list: async (params?: any) => apiRequest('/apps/kuaizhizao/incoming-inspections', { method: 'GET', params }),
    statistics: async () =>
      apiRequest<InspectionStatistics>('/apps/kuaizhizao/incoming-inspections/statistics', { method: 'GET' }),
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
    statistics: async () =>
      apiRequest<InspectionStatistics>('/apps/kuaizhizao/process-inspections/statistics', { method: 'GET' }),
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
    statistics: async () =>
      apiRequest<InspectionStatistics>('/apps/kuaizhizao/finished-goods-inspections/statistics', { method: 'GET' }),
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
    getAnomalies: async (params?: { limit?: number; inspection_type?: string; start_date?: string; end_date?: string }) =>
      apiRequest<QualityAnomaliesResponse>('/apps/kuaizhizao/quality/anomalies', { method: 'GET', params }),
    getReport: async (params?: any) => apiRequest('/apps/kuaizhizao/reports/quality', { method: 'GET', params }),
    getInspectionCenterSummary: async () =>
      apiRequest<InspectionCenterSummary>('/apps/kuaizhizao/quality/inspection-center-summary', { method: 'GET' }),
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
