/**
 * 工单与返工单 API
 */

import { apiRequest } from '../../../services/api';

/** 工单统计（用于指标卡片） */
export interface WorkOrderStatistics {
  in_progress_count: number;
  completed_today_count: number;
  overdue_count: number;
  draft_count: number;
  completed_count: number;
}

export async function getWorkOrderStatistics(): Promise<WorkOrderStatistics> {
  return apiRequest<WorkOrderStatistics>('/apps/kuaizhizao/work-orders/statistics', { method: 'GET' });
}

export const workOrderApi = {
  list: async (params?: any) => apiRequest('/apps/kuaizhizao/work-orders', { method: 'GET', params }),
  create: async (data: any) => apiRequest('/apps/kuaizhizao/work-orders', { method: 'POST', data }),
  update: async (id: string, data: any) => apiRequest(`/apps/kuaizhizao/work-orders/${id}`, { method: 'PUT', data }),
  delete: async (id: string) => apiRequest(`/apps/kuaizhizao/work-orders/${id}`, { method: 'DELETE' }),
  get: async (id: string) => apiRequest(`/apps/kuaizhizao/work-orders/${id}`, { method: 'GET' }),
  release: async (id: string) => apiRequest(`/apps/kuaizhizao/work-orders/${id}/release`, { method: 'POST' }),
  revoke: async (id: string) => apiRequest(`/apps/kuaizhizao/work-orders/${id}/revoke`, { method: 'POST' }),
  complete: async (id: string) => apiRequest(`/apps/kuaizhizao/work-orders/${id}/complete`, { method: 'POST' }),
  split: async (id: string, data: any) => apiRequest(`/apps/kuaizhizao/work-orders/${id}/split`, { method: 'POST', data }),
  getOperations: async (id: string) => apiRequest(`/apps/kuaizhizao/work-orders/${id}/operations`, { method: 'GET' }),
  updateOperations: async (id: string, data: any) => apiRequest(`/apps/kuaizhizao/work-orders/${id}/operations`, { method: 'PUT', data }),
  startOperation: async (workOrderId: string, operationId: number) =>
    apiRequest(`/apps/kuaizhizao/work-orders/${workOrderId}/operations/${operationId}/start`, { method: 'POST' }),
  dispatchOperation: async (workOrderId: string, operationId: number, data: any) =>
    apiRequest(`/apps/kuaizhizao/work-orders/${workOrderId}/operations/${operationId}/dispatch`, { method: 'POST', data }),
  checkShortage: async (workOrderId: string, warehouseId?: number) => {
    const res = await apiRequest<{
      has_shortage: boolean;
      shortage_items?: Array<{
        material_code: string;
        material_name: string;
        required_quantity: number;
        available_quantity: number;
      }>;
    }>(`/apps/kuaizhizao/work-orders/${workOrderId}/check-shortage`, {
      method: 'GET',
      params: warehouseId ? { warehouse_id: warehouseId } : undefined,
    });
    return {
      available: !res.has_shortage,
      missing_materials: (res.shortage_items || []).map((m) => ({
        material_code: m.material_code,
        material_name: m.material_name,
        required: m.required_quantity,
        available: m.available_quantity,
      })),
    };
  },
  freeze: async (id: string, data: { freeze_reason: string }) =>
    apiRequest(`/apps/kuaizhizao/work-orders/${id}/freeze`, { method: 'POST', data }),
  unfreeze: async (id: string, data?: { unfreeze_reason?: string }) =>
    apiRequest(`/apps/kuaizhizao/work-orders/${id}/unfreeze`, { method: 'POST', data: data || {} }),
  setPriority: async (id: string, data: { priority: string }) =>
    apiRequest(`/apps/kuaizhizao/work-orders/${id}/priority`, { method: 'PUT', data }),
  batchSetPriority: async (data: { work_order_ids: number[]; priority: string }) =>
    apiRequest('/apps/kuaizhizao/work-orders/batch-priority', { method: 'PUT', data }),
  batchUpdateDates: async (updates: Array<{ work_order_id: number; planned_start_date: string; planned_end_date: string }>) =>
    apiRequest('/apps/kuaizhizao/work-orders/batch-update-dates', { method: 'PUT', data: { updates } }),
  batchUpdateOperationDates: async (
    updates: Array<{ operation_id: number; planned_start_date: string; planned_end_date: string }>
  ) =>
    apiRequest('/apps/kuaizhizao/work-orders/batch-update-operation-dates', { method: 'PUT', data: { updates } }),
  merge: async (data: { work_order_ids: number[]; remarks?: string }) =>
    apiRequest('/apps/kuaizhizao/work-orders/merge', { method: 'POST', data }),
  generateQRCode: async (workOrderId: string, workOrderCode: string, workOrderName: string): Promise<any> => {
    const { qrcodeApi } = await import('../../../services/qrcode');
    return qrcodeApi.generateWorkOrder({
      work_order_uuid: workOrderId,
      work_order_code: workOrderCode,
      material_code: workOrderName,
    });
  },
  getPrintUrl: (id: string, templateUuid?: string) => {
    const params = new URLSearchParams({ response_format: 'html' });
    if (templateUuid) params.set('template_uuid', templateUuid);
    return `/api/v1/apps/kuaizhizao/work-orders/${id}/print?${params}`;
  },
};

export const reworkOrderApi = {
  list: async (params?: any) => apiRequest('/apps/kuaizhizao/rework-orders', { method: 'GET', params }),
  create: async (data: any) => apiRequest('/apps/kuaizhizao/rework-orders', { method: 'POST', data }),
  update: async (id: string, data: any) => apiRequest(`/apps/kuaizhizao/rework-orders/${id}`, { method: 'PUT', data }),
  delete: async (id: string) => apiRequest(`/apps/kuaizhizao/rework-orders/${id}`, { method: 'DELETE' }),
  get: async (id: string) => apiRequest(`/apps/kuaizhizao/rework-orders/${id}`, { method: 'GET' }),
  createFromWorkOrder: async (workOrderId: string, data: any) =>
    apiRequest(`/apps/kuaizhizao/work-orders/${workOrderId}/rework`, { method: 'POST', data }),
};
