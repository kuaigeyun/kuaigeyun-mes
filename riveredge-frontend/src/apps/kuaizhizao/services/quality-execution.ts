/**
 * 来料检验、过程检验、成品检验、质量统计等质量管理执行 API
 */

import { apiRequest } from '../../../services/api';
import type { PushPreviewResponse } from './sales-order';

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
  pending_oqc?: number;
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

/** 组织级质检环节总开关（与后端 TenantConfig quality_inspection_stages 一致） */
export interface QualityInspectionStageToggles {
  iqc_enabled: boolean;
  ipqc_enabled: boolean;
  fqc_enabled: boolean;
  oqc_enabled: boolean;
}

/** 采购入库确认前 IQC ensure 结果 */
export interface EnsureIqcForPurchaseReceiptLineSummary {
  receipt_item_id: number;
  material_id: number;
  material_code: string;
  material_name: string;
  receipt_quantity: number;
  iqc_required: boolean;
  iqc_mode?: string | null;
  plan_label?: string | null;
  inspection_id?: number | null;
  inspection_code?: string | null;
  inspection_status?: string | null;
  quality_status?: string | null;
  review_status?: string | null;
  passed: boolean;
  can_inbound: boolean;
}

export interface EnsureIqcForPurchaseReceiptResult {
  can_confirm_inbound: boolean;
  requires_iqc: boolean;
  gate_enabled: boolean;
  iqc_stage_enabled: boolean;
  iqc_module_enabled: boolean;
  created_count: number;
  created_inspections: unknown[];
  pending_inspections: unknown[];
  line_summaries: EnsureIqcForPurchaseReceiptLineSummary[];
  message?: string | null;
}

/** 代工来料确认前 IQC ensure 结果 */
export interface EnsureIqcForCustomerMaterialRegistrationResult {
  can_confirm_inbound: boolean;
  requires_iqc: boolean;
  gate_enabled: boolean;
  iqc_stage_enabled: boolean;
  iqc_module_enabled: boolean;
  registration_code?: string | null;
  created_count: number;
  created_inspections: unknown[];
  pending_inspections: unknown[];
  line_summaries: EnsureIqcForPurchaseReceiptLineSummary[];
  message?: string | null;
}

/** 成品入库确认前 FQC ensure 结果 */
export interface EnsureFqcForFinishedGoodsReceiptLineSummary {
  receipt_item_id: number;
  material_id: number;
  material_code: string;
  material_name: string;
  receipt_quantity: number;
  fqc_required: boolean;
  fqc_mode?: string | null;
  plan_label?: string | null;
  inspection_id?: number | null;
  inspection_code?: string | null;
  inspection_status?: string | null;
  quality_status?: string | null;
  review_status?: string | null;
  passed: boolean;
  can_inbound: boolean;
}

export interface EnsureFqcForFinishedGoodsReceiptResult {
  can_confirm_inbound: boolean;
  requires_fqc: boolean;
  gate_enabled: boolean;
  fqc_stage_enabled: boolean;
  fqc_module_enabled: boolean;
  work_order_id?: number | null;
  work_order_code?: string | null;
  created_count: number;
  created_inspections: unknown[];
  pending_inspections: unknown[];
  line_summaries: EnsureFqcForFinishedGoodsReceiptLineSummary[];
  message?: string | null;
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
    revokeConduct: async (id: string) =>
      apiRequest(`/apps/kuaizhizao/incoming-inspections/${id}/revoke-conduct`, { method: 'POST' }),
    approve: async (id: string, data: any) =>
      apiRequest(`/apps/kuaizhizao/incoming-inspections/${id}/approve`, { method: 'POST', data }),
    pushToPurchaseReturn: async (id: string, data?: { quantity?: number }) =>
      apiRequest(`/apps/kuaizhizao/incoming-inspections/${id}/push-to-purchase-return`, {
        method: 'POST',
        data: data?.quantity != null ? { quantity: data.quantity } : undefined,
      }),
    previewPushToPurchaseReturn: async (id: string) =>
      apiRequest(`/apps/kuaizhizao/incoming-inspections/${id}/push-to-purchase-return/preview`, { method: 'GET' }),
    listPurchaseReceiptPullCandidates: async (params?: {
      skip?: number;
      limit?: number;
      keyword?: string;
      receipt_code?: string;
      /** 采购入库单状态，如「已入库」用于补检入口 */
      status?: string;
      /** 已入库补检：纳入未配置来料检验的物料 */
      include_unset_iqc?: boolean;
    }) =>
      apiRequest<{ data: Array<Record<string, unknown>>; total: number; success: boolean }>(
        '/apps/kuaizhizao/incoming-inspections/pull-candidates/purchase-receipts',
        { method: 'GET', params },
      ),
    listCustomerMaterialPullCandidates: async (params?: {
      skip?: number;
      limit?: number;
      keyword?: string;
      registration_code?: string;
    }) =>
      apiRequest<{ data: Array<Record<string, unknown>>; total: number; success: boolean }>(
        '/apps/kuaizhizao/incoming-inspections/pull-candidates/customer-material-registrations',
        { method: 'GET', params },
      ),
    previewPullFromPurchaseReceipt: async (purchaseReceiptId: string) =>
      apiRequest(`/apps/kuaizhizao/incoming-inspections/from-purchase-receipt/${purchaseReceiptId}/pull-preview`, {
        method: 'GET',
      }),
    previewPullFromCustomerMaterial: async (registrationId: string) =>
      apiRequest(`/apps/kuaizhizao/incoming-inspections/from-customer-material/${registrationId}/pull-preview`, {
        method: 'GET',
      }),
    createFromPurchaseReceipt: async (
      purchaseReceiptId: string,
      options?: {
        selectedItemIds?: number[];
        includeUnsetIqc?: boolean;
        inspectionPlanId?: number;
      },
    ) => {
      const payload: Record<string, unknown> = {};
      if (options?.selectedItemIds?.length) {
        payload.selected_item_ids = options.selectedItemIds;
      }
      if (options?.includeUnsetIqc) {
        payload.include_unset_iqc = true;
      }
      if (options?.inspectionPlanId != null && options.inspectionPlanId > 0) {
        payload.inspection_plan_id = options.inspectionPlanId;
      }
      return apiRequest(`/apps/kuaizhizao/incoming-inspections/from-purchase-receipt/${purchaseReceiptId}`, {
        method: 'POST',
        data: Object.keys(payload).length ? payload : undefined,
      });
    },
    ensureForPurchaseReceipt: async (purchaseReceiptId: string) =>
      apiRequest<EnsureIqcForPurchaseReceiptResult>(
        `/apps/kuaizhizao/incoming-inspections/ensure-for-purchase-receipt/${purchaseReceiptId}`,
        { method: 'POST' },
      ),
    ensureForCustomerMaterialRegistration: async (registrationId: string) =>
      apiRequest<EnsureIqcForCustomerMaterialRegistrationResult>(
        `/apps/kuaizhizao/incoming-inspections/ensure-for-customer-material-registration/${registrationId}`,
        { method: 'POST' },
      ),
    createFromCustomerMaterial: async (registrationId: string, selectedItemIds?: number[]) =>
      apiRequest(`/apps/kuaizhizao/incoming-inspections/from-customer-material/${registrationId}`, {
        method: 'POST',
        data: selectedItemIds?.length ? { selected_item_ids: selectedItemIds } : undefined,
      }),
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
    revokeConduct: async (id: string) =>
      apiRequest(`/apps/kuaizhizao/process-inspections/${id}/revoke-conduct`, { method: 'POST' }),
    approve: async (id: string, data: any) =>
      apiRequest(`/apps/kuaizhizao/process-inspections/${id}/approve`, { method: 'POST', data }),
    createFromWorkOrder: async (workOrderId: string, operationId: string) =>
      apiRequest(
        `/apps/kuaizhizao/process-inspections/from-work-order?work_order_id=${workOrderId}&operation_id=${operationId}`,
        { method: 'POST' }
      ),
    listWorkOrderPullCandidates: async (params?: { skip?: number; limit?: number; keyword?: string; code?: string }) =>
      apiRequest<{ data: Array<Record<string, unknown>>; total: number; success: boolean }>(
        '/apps/kuaizhizao/process-inspections/pull-candidates/work-orders',
        { method: 'GET', params },
      ),
    previewPullFromWorkOrder: async (workOrderId: string) =>
      apiRequest(`/apps/kuaizhizao/process-inspections/from-work-order/${workOrderId}/pull-preview`, {
        method: 'GET',
      }),
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
    revokeConduct: async (id: string) =>
      apiRequest(`/apps/kuaizhizao/finished-goods-inspections/${id}/revoke-conduct`, { method: 'POST' }),
    approve: async (id: string, data: any) =>
      apiRequest(`/apps/kuaizhizao/finished-goods-inspections/${id}/approve`, { method: 'POST', data }),
    pushToRework: async (id: string, data?: { quantity?: number }) =>
      apiRequest(`/apps/kuaizhizao/finished-goods-inspections/${id}/push-to-rework`, {
        method: 'POST',
        data: data?.quantity != null ? { quantity: data.quantity } : undefined,
      }),
    previewPushToRework: async (id: string) =>
      apiRequest<PushPreviewResponse>(
        `/apps/kuaizhizao/finished-goods-inspections/${id}/push-to-rework/preview`,
        { method: 'GET' },
      ),
    pushToInbound: async (
      id: string,
      data?: { quantity?: number; warehouse_id?: number },
    ) =>
      apiRequest(`/apps/kuaizhizao/finished-goods-inspections/${id}/push-to-inbound`, {
        method: 'POST',
        data:
          data?.quantity != null || data?.warehouse_id != null
            ? { quantity: data?.quantity, warehouse_id: data?.warehouse_id }
            : undefined,
      }),
    previewPushToInbound: async (id: string) =>
      apiRequest<PushPreviewResponse>(
        `/apps/kuaizhizao/finished-goods-inspections/${id}/push-to-inbound/preview`,
        { method: 'GET' },
      ),
    listWorkOrderPullCandidates: async (params?: { skip?: number; limit?: number; keyword?: string; code?: string }) =>
      apiRequest<{ data: Array<Record<string, unknown>>; total: number; success: boolean }>(
        '/apps/kuaizhizao/finished-goods-inspections/pull-candidates/work-orders',
        { method: 'GET', params },
      ),
    previewPullFromWorkOrder: async (workOrderId: string) =>
      apiRequest(`/apps/kuaizhizao/finished-goods-inspections/from-work-order/${workOrderId}/pull-preview`, {
        method: 'GET',
      }),
    certificate: async (id: string, data: any) =>
      apiRequest(`/apps/kuaizhizao/finished-goods-inspections/${id}/certificate`, { method: 'POST', data }),
    createFromWorkOrder: async (workOrderId: string) =>
      apiRequest(
        `/apps/kuaizhizao/finished-goods-inspections/from-work-order?work_order_id=${workOrderId}`,
        { method: 'POST' }
      ),
    ensureForFinishedGoodsReceipt: async (finishedGoodsReceiptId: string) =>
      apiRequest<EnsureFqcForFinishedGoodsReceiptResult>(
        `/apps/kuaizhizao/finished-goods-inspections/ensure-for-finished-goods-receipt/${finishedGoodsReceiptId}`,
        { method: 'POST' },
      ),
    ensureForSemiFinishedGoodsReceipt: async (semiFinishedGoodsReceiptId: string) =>
      apiRequest<EnsureFqcForFinishedGoodsReceiptResult>(
        `/apps/kuaizhizao/finished-goods-inspections/ensure-for-semi-finished-goods-receipt/${semiFinishedGoodsReceiptId}`,
        { method: 'POST' },
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
  /** IQC/IPQC/FQC/OQC 环节是否允许下推/创建对应质检单（关闭后服务端直接拒绝） */
  stageToggles: {
    get: async () =>
      apiRequest<QualityInspectionStageToggles>('/apps/kuaizhizao/quality-inspection-stage-toggles', {
        method: 'GET',
      }),
    update: async (data: Partial<QualityInspectionStageToggles>) =>
      apiRequest<QualityInspectionStageToggles>('/apps/kuaizhizao/quality-inspection-stage-toggles', {
        method: 'PUT',
        data,
      }),
  },
  effectiveConfig: {
    get: async () =>
      apiRequest<{
        stage_enabled: Record<string, boolean>;
        module_enabled: Record<string, boolean>;
        auto_create: Record<string, boolean>;
        gate: Record<string, boolean>;
      }>('/apps/kuaizhizao/quality-effective-config', { method: 'GET' }),
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
export interface InspectionPlanListResult {
  items: unknown[];
  total: number;
}

export function unwrapInspectionPlanList(res: InspectionPlanListResult | unknown[] | null | undefined): unknown[] {
  if (Array.isArray(res)) return res;
  if (res && typeof res === 'object') {
    const obj = res as InspectionPlanListResult & { data?: unknown[] };
    return Array.isArray(obj.items) ? obj.items : Array.isArray(obj.data) ? obj.data : [];
  }
  return [];
}

export const inspectionPlanApi = {
  list: async (params?: Record<string, unknown>): Promise<InspectionPlanListResult> =>
    apiRequest('/apps/kuaizhizao/inspection-plans', { method: 'GET', params }),
  create: async (data: any) => apiRequest('/apps/kuaizhizao/inspection-plans', { method: 'POST', data }),
  update: async (id: string, data: any) => apiRequest(`/apps/kuaizhizao/inspection-plans/${id}`, { method: 'PUT', data }),
  delete: async (id: string) => apiRequest(`/apps/kuaizhizao/inspection-plans/${id}`, { method: 'DELETE' }),
  get: async (id: string) => apiRequest(`/apps/kuaizhizao/inspection-plans/${id}`, { method: 'GET' }),
  getByMaterial: async (materialId: string, params?: any) =>
    apiRequest(`/apps/kuaizhizao/inspection-plans/by-material/${materialId}`, { method: 'GET', params }),
};
