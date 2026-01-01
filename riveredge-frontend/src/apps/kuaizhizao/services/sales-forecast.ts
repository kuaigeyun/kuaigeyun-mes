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

