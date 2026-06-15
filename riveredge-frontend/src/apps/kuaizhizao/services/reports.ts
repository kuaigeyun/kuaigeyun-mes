/**
 * 报表分析API服务
 *
 * 提供报表分析相关的API调用接口
 *
 * @author RiverEdge Team
 * @date 2025-12-29
 */

import { getToken } from '../../../utils/auth';
import { updateLastActivity, incrementPendingRequests, decrementPendingRequests } from '../../../utils/activityUtils';
import { apiRequest } from '../../../services/api';

/**
 * 报表通用参数接口
 */
export interface ReportParams {
  startDate?: string;
  endDate?: string;
  date_start?: string;
  date_end?: string;
  reportType?: string;
  /** @deprecated Prefer reportType; kept for backend query parity */
  report_type?: string;
  skip?: number;
  limit?: number;
  customer_keyword?: string;
  filters?: Record<string, any>;
}

/**
 * 库存报表接口定义
 */
export interface InventoryReportData {
  materialCode: string;
  materialName: string;
  category: string;
  warehouseName: string;
  currentStock: number;
  availableStock: number;
  reservedStock: number;
  minStock: number;
  maxStock: number;
  unit: string;
  unitPrice: number;
  totalValue: number;
  turnoverRate: number;
  turnoverDays: number;
  status: 'normal' | 'low' | 'high' | 'out_of_stock';
}

export interface InventoryAnalysisData {
  turnover_rate?: {
    total_turnover_rate?: number;
    average_turnover_rate?: number;
    top_materials?: Array<{
      material_id: number;
      material_code: string;
      material_name: string;
      turnover_rate: number;
      inventory_value: number;
    }>;
  };
  abc_analysis?: {
    category_a?: {
      count: number;
      percentage: number;
      value: number;
      value_percentage: number;
      materials: Array<{
        material_id: number;
        material_code: string;
        material_name: string;
        inventory_value: number;
        percentage: number;
      }>;
    };
    category_b?: {
      count: number;
      percentage: number;
      value: number;
      value_percentage: number;
      materials: any[];
    };
    category_c?: {
      count: number;
      percentage: number;
      value: number;
      value_percentage: number;
      materials: any[];
    };
  };
  slow_moving_analysis?: {
    total_count: number;
    total_value: number;
    materials: Array<{
      material_id: number;
      material_code: string;
      material_name: string;
      inventory_quantity: number;
      inventory_value: number;
      last_outbound_date: string;
      days_since_last_outbound: number;
    }>;
  };
}

export interface InventoryCostAnalysisData {
  period?: {
    start: string;
    end: string;
  };
  summary?: {
    total_cost: number;
    average_cost: number;
    cost_trend: string;
  };
  by_category?: Array<{
    category: string;
    cost: number;
    percentage: number;
  }>;
  by_warehouse?: Array<{
    warehouse_id: number;
    warehouse_name: string;
    cost: number;
    percentage: number;
  }>;
  trend_data?: Array<{
    date: string;
    cost: number;
  }>;
}

export interface InventoryReportResponse {
  data: InventoryReportData[];
  summary: {
    totalItems: number;
    totalValue: number;
    lowStockItems: number;
    outOfStockItems: number;
    normalStockItems: number;
    highStockItems: number;
  };
  success: boolean;
}

/**
 * 生产报表接口定义
 */
export interface ProductionReportData {
  workOrderCode: string;
  productName: string;
  plannedQuantity: number;
  actualQuantity: number;
  qualifiedQuantity: number;
  defectiveQuantity: number;
  completionRate: number;
  qualifiedRate: number;
  plannedDuration: number;
  actualDuration: number;
  efficiency: number;
  status: 'completed' | 'in_progress' | 'delayed' | 'cancelled';
  delayDays: number;
  plannedStartDate?: string;
  actualStartDate?: string;
  plannedEndDate?: string;
  actualEndDate?: string;
}

export interface ProductionReportResponse {
  data: ProductionReportData[];
  summary: {
    totalWorkOrders: number;
    completedWorkOrders: number;
    onTimeCompletion: number;
    averageEfficiency: number;
    averageQualifiedRate: number;
    totalDelayDays: number;
  };
  success: boolean;
}

/**
 * 质量报表接口定义
 */
export interface QualityReportData {
  inspectionType: 'incoming' | 'process' | 'finished';
  inspectionCode: string;
  productCode: string;
  productName: string;
  batchNo: string;
  totalQuantity: number;
  qualifiedQuantity: number;
  unqualifiedQuantity: number;
  qualifiedRate: number;
  inspectorName: string;
  inspectionDate: string;
  status: 'qualified' | 'unqualified' | 'conditional';
  defectTypes?: string[];
  remarks?: string;
}

export interface QualityReportResponse {
  data: QualityReportData[];
  summary: {
    totalInspections: number;
    qualifiedInspections: number;
    unqualifiedInspections: number;
    overallQualifiedRate: number;
    incomingQualifiedRate: number;
    processQualifiedRate: number;
    finishedQualifiedRate: number;
  };
  success: boolean;
}

/**
 * 图表数据接口定义
 */
export interface ChartDataPoint {
  month: string;
  value: number;
  type?: string;
}

export interface TrendChartData {
  inventoryTurnover: ChartDataPoint[];
  productionEfficiency: ChartDataPoint[];
  qualityTrend: ChartDataPoint[];
}

/** 库存统计（用于指标卡片） */
export interface InventoryStatistics {
  total_items: number;
  total_quantity: number;
  total_value: number;
  low_stock_items: number;
  out_of_stock_items: number;
  high_stock_items: number;
  normal_stock_items: number;
}

/**
 * 报表响应包装：apiRequest 对形如 `{ success: true, data: [...] }` 但缺少 `total`
 * 字段的响应会自动解包成数组，导致上层组件读取 `res.data / res.success` 时拿到 undefined。
 * 这里把后端报表响应统一规整回 `{ data, success, summary }` 形态，供 UniReport / KuaizhizaoReport 列表正常显示。
 */
function buildReportQueryParams(
  params: ReportParams & { report_type?: string; reportType?: string },
  defaults?: { report_type?: string },
): Record<string, unknown> {
  const query: Record<string, unknown> = {
    report_type: params.report_type ?? params.reportType ?? defaults?.report_type,
    date_start: params.date_start ?? params.startDate,
    date_end: params.date_end ?? params.endDate,
  };
  if (params.skip != null) query.skip = params.skip;
  if (params.limit != null) query.limit = params.limit;
  if (params.customer_keyword) query.customer_keyword = params.customer_keyword;
  if (params.customer_id != null) query.customer_id = params.customer_id;
  if (params.filters?.customer_id != null) query.customer_id = params.filters.customer_id;
  if (params.filters?.warehouse_id != null) query.warehouse_id = params.filters.warehouse_id;
  if (params.filters?.material_id != null) query.material_id = params.filters.material_id;
  if (params.filters?.work_center_id != null) query.work_center_id = params.filters.work_center_id;
  return query;
}

function normalizeReportResponse<T extends { data: any[]; success: boolean; summary?: any }>(
  res: any,
): T {
  if (res == null) {
    return { data: [], success: true, summary: {} } as unknown as T;
  }
  if (Array.isArray(res)) {
    return { data: res, success: true, summary: {} } as unknown as T;
  }
  if (typeof res === 'object') {
    const data = Array.isArray(res.data) ? res.data : Array.isArray(res.items) ? res.items : [];
    const summary = res.summary ?? {};
    const success = typeof res.success === 'boolean' ? res.success : true;
    const total = typeof res.total === 'number' ? res.total : undefined;
    return { ...res, data, summary, success, ...(total !== undefined ? { total } : {}) } as unknown as T;
  }
  return { data: [], success: true, summary: {} } as unknown as T;
}

/** 获取库存统计 */
export async function getInventoryStatistics(warehouseId?: number): Promise<InventoryStatistics> {
  return apiRequest<InventoryStatistics>('/apps/kuaizhizao/reports/inventory/statistics', {
    method: 'GET',
    params: warehouseId ? { warehouse_id: warehouseId } : {},
  });
}

// 库存报表API
export async function getInventoryReport(params: ReportParams & { report_type?: string } = {}): Promise<InventoryReportResponse> {
  const res = await apiRequest<any>('/apps/kuaizhizao/reports/inventory', {
    method: 'GET',
    params: buildReportQueryParams(params, { report_type: 'summary' }),
  });
  return normalizeReportResponse<InventoryReportResponse>(res);
}

export async function exportInventoryReport(params: ReportParams = {}): Promise<Blob> {
  return apiRequest<Blob>('/apps/kuaizhizao/reports/inventory-report/export', {
    method: 'GET',
    params,
    responseType: 'blob',
  });
}

// 生产报表API
export async function getProductionReport(params: ReportParams & { report_type?: string } = {}): Promise<ProductionReportResponse> {
  const res = await apiRequest<any>('/apps/kuaizhizao/reports/production', {
    method: 'GET',
    params: buildReportQueryParams(params, { report_type: 'efficiency' }),
  });
  return normalizeReportResponse<ProductionReportResponse>(res);
}

export async function exportProductionReport(params: ReportParams = {}): Promise<Blob> {
  return apiRequest<Blob>('/apps/kuaizhizao/reports/production-report/export', {
    method: 'GET',
    params,
    responseType: 'blob',
  });
}

// 质量报表API
export async function getQualityReport(params: ReportParams & { report_type?: string } = {}): Promise<QualityReportResponse> {
  const res = await apiRequest<any>('/apps/kuaizhizao/reports/quality', {
    method: 'GET',
    params: buildReportQueryParams(params, { report_type: 'analysis' }),
  });
  return normalizeReportResponse<QualityReportResponse>(res);
}

export async function exportQualityReport(params: ReportParams = {}): Promise<Blob> {
  return apiRequest<Blob>('/apps/kuaizhizao/reports/quality-report/export', {
    method: 'GET',
    params,
    responseType: 'blob',
  });
}

/** 销售报表接口定义 */
export interface SalesReportResponse {
  data: any[];
  summary: Record<string, any>;
  success: boolean;
  /** 后端分页总条数（部分报表接口返回） */
  total?: number;
}

/** 从 ProTable / UniTable 搜索表单解析日期范围（YYYY-MM-DD） */
export function parseSalesReportDateRange(
  searchFormValues?: Record<string, any>,
  keys: string[] = ['date_range', 'dateRange', 'transaction_date'],
): { date_start?: string; date_end?: string } {
  if (!searchFormValues) return {};
  for (const k of keys) {
    const dr = searchFormValues[k];
    if (Array.isArray(dr) && dr.length === 2) {
      const fmt = (v: any) =>
        v && typeof v.format === 'function' ? v.format('YYYY-MM-DD') : v != null ? String(v) : undefined;
      return { date_start: fmt(dr[0]), date_end: fmt(dr[1]) };
    }
  }
  return {};
}

/** UniTable 分页 → 销售报表 skip/limit */
export function salesReportPageParams(params: any): { skip: number; limit: number } {
  const pageSize = params.pageSize ?? 20;
  const current = params.current ?? 1;
  return { skip: Math.max(0, (Number(current) - 1) * Number(pageSize)), limit: Number(pageSize) };
}

/** 获取销售报表 */
export async function getSalesReport(params: ReportParams & { report_type?: string } = {}): Promise<SalesReportResponse> {
  const res = await apiRequest<any>('/apps/kuaizhizao/reports/sales', {
    method: 'GET',
    params: buildReportQueryParams(params, { report_type: 'summary' }),
  });
  return normalizeReportResponse<SalesReportResponse>(res);
}

/** 获取计划报表 */
export async function getPlanReport(params: ReportParams & { report_type?: string } = {}): Promise<SalesReportResponse> {
  const res = await apiRequest<any>('/apps/kuaizhizao/reports/plans', {
    method: 'GET',
    params: buildReportQueryParams(params, { report_type: 'fulfillment' }),
  });
  return normalizeReportResponse<SalesReportResponse>(res);
}

/** 获取采购报表 */
export async function getPurchaseReport(params: ReportParams & { report_type?: string } = {}): Promise<SalesReportResponse> {
  const res = await apiRequest<any>('/apps/kuaizhizao/reports/purchases', {
    method: 'GET',
    params: buildReportQueryParams(params, { report_type: 'requisition_tracking' }),
  });
  return normalizeReportResponse<SalesReportResponse>(res);
}

/** 获取设备报表 */
export async function getEquipmentReport(params: ReportParams & { report_type?: string } = {}): Promise<SalesReportResponse> {
  const res = await apiRequest<any>('/apps/kuaizhizao/reports/equipment', {
    method: 'GET',
    params: buildReportQueryParams(params, { report_type: 'maint_plan' }),
  });
  return normalizeReportResponse<SalesReportResponse>(res);
}

/** 获取仓库报表 (如果与现有 inventory 报表不重合) */
export async function getWarehouseReport(params: ReportParams & { report_type?: string } = {}): Promise<SalesReportResponse> {
  const res = await apiRequest<any>('/apps/kuaizhizao/reports/warehouse', {
    method: 'GET',
    params: buildReportQueryParams(params, { report_type: 'inventory_ledger' }),
  });
  return normalizeReportResponse<SalesReportResponse>(res);
}

/** 获取绩效报表 */
export async function getPerformanceReport(params: ReportParams & { report_type?: string } = {}): Promise<SalesReportResponse> {
  const res = await apiRequest<any>('/apps/kuaizhizao/reports/performance', {
    method: 'GET',
    params: buildReportQueryParams(params, { report_type: 'employee-efficiency-ranking' }),
  });
  return normalizeReportResponse<SalesReportResponse>(res);
}

// 图表数据API

export async function getReportCharts(params: ReportParams = {}): Promise<TrendChartData> {
  return apiRequest<TrendChartData>('/apps/kuaizhizao/reports/charts', {
    method: 'GET',
    params,
  });
}

// 库存分析API
export const inventoryAnalysisApi = {
  getAnalysis: async (params: {
    date_start?: string;
    date_end?: string;
    warehouse_id?: number;
  }): Promise<InventoryAnalysisData> => {
    return apiRequest<InventoryAnalysisData>('/apps/kuaizhizao/inventory-analysis', {
      method: 'GET',
      params,
    });
  },
  getCostAnalysis: async (params: {
    date_start?: string;
    date_end?: string;
    warehouse_id?: number;
  }): Promise<InventoryCostAnalysisData> => {
    return apiRequest<InventoryCostAnalysisData>('/apps/kuaizhizao/inventory-analysis/cost', {
      method: 'GET',
      params,
    });
  },
};

function normalizeExportBody(params: ReportParams): Record<string, unknown> {
  const body: Record<string, unknown> = {
    report_type: params.report_type || params.reportType,
    date_start: params.date_start || params.startDate,
    date_end: params.date_end || params.endDate,
    customer_keyword: params.customer_keyword,
    warehouse_id: params.filters?.warehouse_id,
    customer_id: params.filters?.customer_id,
    material_id: params.filters?.material_id,
    ...params,
  };
  if (!body.date_start || !body.date_end) {
    const { date_start, date_end } = parseSalesReportDateRange(params as Record<string, unknown>, [
      'order_date_range',
      'date_range',
      'dateRange',
    ]);
    if (date_start) body.date_start = date_start;
    if (date_end) body.date_end = date_end;
  }
  return body;
}

/**
 * 按域导出报表（POST /reports/{domain}/export，携带与列表相同的 filter body）
 */
export async function exportDomainReport(domain: string, params: ReportParams = {}): Promise<void> {
  updateLastActivity(true);
  incrementPendingRequests();
  try {
    const response = await fetch(`/api/v1/apps/kuaizhizao/reports/${encodeURIComponent(domain)}/export`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
        'X-Tenant-ID': localStorage.getItem('tenant_id') || '',
      },
      body: JSON.stringify(normalizeExportBody(params)),
    });

    if (!response.ok) {
      throw new Error('导出失败');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const reportType = params.report_type || params.reportType || 'report';
    link.download = `${domain}-${reportType}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    throw new Error('导出失败：' + (error as Error).message);
  } finally {
    updateLastActivity(true);
    decrementPendingRequests();
  }
}

/**
 * 通用报表导出功能
 * @deprecated 请使用 exportDomainReport(domain, params)
 */
export async function exportReport(reportType: string, params: ReportParams = {}): Promise<void> {
  const domain = (params as ReportParams & { domain?: string }).domain || 'sales';
  return exportDomainReport(domain, { ...params, report_type: reportType });
}
