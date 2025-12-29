/**
 * 报表分析API服务
 *
 * 提供报表分析相关的API调用接口
 *
 * @author RiverEdge Team
 * @date 2025-12-29
 */

import { apiRequest } from '../../../services/api';

/**
 * 报表通用参数接口
 */
export interface ReportParams {
  startDate?: string;
  endDate?: string;
  reportType?: string;
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

// 库存报表API
export async function getInventoryReport(params: ReportParams = {}): Promise<InventoryReportResponse> {
  return apiRequest<InventoryReportResponse>({
    url: '/apps/kuaizhizao/reports/inventory-report',
    method: 'GET',
    params,
  });
}

export async function exportInventoryReport(params: ReportParams = {}): Promise<Blob> {
  return apiRequest<Blob>({
    url: '/apps/kuaizhizao/reports/inventory-report/export',
    method: 'GET',
    params,
    responseType: 'blob',
  });
}

// 生产报表API
export async function getProductionReport(params: ReportParams = {}): Promise<ProductionReportResponse> {
  return apiRequest<ProductionReportResponse>({
    url: '/apps/kuaizhizao/reports/production-report',
    method: 'GET',
    params,
  });
}

export async function exportProductionReport(params: ReportParams = {}): Promise<Blob> {
  return apiRequest<Blob>({
    url: '/apps/kuaizhizao/reports/production-report/export',
    method: 'GET',
    params,
    responseType: 'blob',
  });
}

// 质量报表API
export async function getQualityReport(params: ReportParams = {}): Promise<QualityReportResponse> {
  return apiRequest<QualityReportResponse>({
    url: '/apps/kuaizhizao/reports/quality-report',
    method: 'GET',
    params,
  });
}

export async function exportQualityReport(params: ReportParams = {}): Promise<Blob> {
  return apiRequest<Blob>({
    url: '/apps/kuaizhizao/reports/quality-report/export',
    method: 'GET',
    params,
    responseType: 'blob',
  });
}

// 图表数据API
export async function getReportCharts(params: ReportParams = {}): Promise<TrendChartData> {
  return apiRequest<TrendChartData>({
    url: '/apps/kuaizhizao/reports/charts',
    method: 'GET',
    params,
  });
}

/**
 * 通用报表导出功能
 */
export async function exportReport(reportType: string, params: ReportParams = {}): Promise<void> {
  try {
    const response = await fetch(`/api/v1/apps/kuaizhizao/reports/${reportType}/export?${new URLSearchParams(params as any)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'X-Tenant-ID': localStorage.getItem('tenant_id') || '',
      },
    });

    if (!response.ok) {
      throw new Error('导出失败');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${reportType}-report-${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    throw new Error('导出失败：' + (error as Error).message);
  }
}
