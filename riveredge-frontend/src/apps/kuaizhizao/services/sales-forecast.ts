/**
 * 销售预测API服务
 *
 * 提供销售预测相关的API调用接口
 *
 * @author RiverEdge Team
 * @date 2025-01-01
 */

import { apiRequest } from '../../../services/api';

/**
 * 销售预测接口定义
 */
export interface SalesForecast {
  id?: number;
  tenant_id?: number;
  forecast_code?: string;
  forecast_name?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
  reviewer_id?: number;
  reviewer_name?: string;
  review_time?: string;
  review_status?: string;
  review_remarks?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  forecast_items?: SalesForecastItem[];
}

export interface SalesForecastItem {
  id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  component_type?: string;
  forecast_date?: string;
  forecast_quantity?: number;
}

export interface SalesForecastListParams {
  skip?: number;
  limit?: number;
  status?: string;
  start_date?: string;
  end_date?: string;
  keyword?: string;
}

export interface SalesForecastListResponse {
  data: SalesForecast[];
  total: number;
  success: boolean;
}

/**
 * 获取销售预测列表
 */
export async function listSalesForecasts(params: SalesForecastListParams = {}): Promise<SalesForecastListResponse> {
  return apiRequest<SalesForecastListResponse>({
    url: '/apps/kuaizhizao/sales-forecasts',
    method: 'GET',
    params,
  });
}

/**
 * 创建销售预测
 */
export async function createSalesForecast(data: SalesForecast): Promise<SalesForecast> {
  return apiRequest<SalesForecast>({
    url: '/apps/kuaizhizao/sales-forecasts',
    method: 'POST',
    data,
  });
}

/**
 * 获取销售预测详情
 */
export async function getSalesForecast(id: number): Promise<SalesForecast> {
  return apiRequest<SalesForecast>({
    url: `/apps/kuaizhizao/sales-forecasts/${id}`,
    method: 'GET',
  });
}

/**
 * 更新销售预测
 */
export async function updateSalesForecast(id: number, data: Partial<SalesForecast>): Promise<SalesForecast> {
  return apiRequest<SalesForecast>({
    url: `/apps/kuaizhizao/sales-forecasts/${id}`,
    method: 'PUT',
    data,
  });
}

/**
 * 删除销售预测
 */
export async function deleteSalesForecast(id: number): Promise<void> {
  return apiRequest<void>({
    url: `/apps/kuaizhizao/sales-forecasts/${id}`,
    method: 'DELETE',
  });
}

/**
 * 审核销售预测
 */
export async function approveSalesForecast(id: number, rejection_reason?: string): Promise<SalesForecast> {
  return apiRequest<SalesForecast>({
    url: `/apps/kuaizhizao/sales-forecasts/${id}/approve`,
    method: 'POST',
    data: { rejection_reason },
  });
}

/**
 * 获取销售预测明细
 */
export async function getSalesForecastItems(id: number): Promise<SalesForecastItem[]> {
  return apiRequest<SalesForecastItem[]>({
    url: `/apps/kuaizhizao/sales-forecasts/${id}/items`,
    method: 'GET',
  });
}

/**
 * 提交销售预测
 */
export async function submitSalesForecast(id: number): Promise<SalesForecast> {
  return apiRequest<SalesForecast>({
    url: `/apps/kuaizhizao/sales-forecasts/${id}/submit`,
    method: 'POST',
  });
}

/**
 * 批量导入销售预测
 */
export async function importSalesForecasts(data: any[][]): Promise<{
  success: boolean;
  message: string;
  total: number;
  success_count: number;
  failure_count: number;
  errors: Array<{ row: number; error: string }>;
}> {
  return apiRequest({
    url: '/apps/kuaizhizao/sales-forecasts/import',
    method: 'POST',
    data: { data },
  });
}

/**
 * 批量导出销售预测
 */
export async function exportSalesForecasts(params?: SalesForecastListParams): Promise<Blob> {
  return apiRequest<Blob>({
    url: '/apps/kuaizhizao/sales-forecasts/export',
    method: 'GET',
    params,
    responseType: 'blob',
  });
}

/**
 * 获取单据关联关系
 */
export interface DocumentRelation {
  document_type: string;
  document_id: number;
  upstream_documents: Array<{
    document_type: string;
    document_id: number;
    document_code?: string;
    document_name?: string;
    status?: string;
    created_at?: string;
  }>;
  downstream_documents: Array<{
    document_type: string;
    document_id: number;
    document_code?: string;
    document_name?: string;
    status?: string;
    created_at?: string;
  }>;
  upstream_count: number;
  downstream_count: number;
}

export async function getDocumentRelations(
  documentType: string,
  documentId: number
): Promise<DocumentRelation> {
  return apiRequest<DocumentRelation>({
    url: `/apps/kuaizhizao/production/documents/${documentType}/${documentId}/relations`,
    method: 'GET',
  });
}

