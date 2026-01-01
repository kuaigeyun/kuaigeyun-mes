/**
 * MRP运算API服务
 *
 * 提供MRP运算相关的API调用接口
 *
 * @author RiverEdge Team
 * @date 2025-01-15
 */

import { apiRequest } from '../../../services/api';
import { listSalesForecasts, SalesForecast } from './sales-forecast';

/**
 * MRP运算请求接口
 */
export interface MRPComputationRequest {
  forecast_id: number;
  planning_horizon?: number; // 计划时域（天），默认30
  time_bucket?: string; // 时间段（日/周/月），默认"周"
  include_safety_stock?: boolean; // 是否考虑安全库存，默认true
  explosion_type?: string; // 展开类型，默认"single_level"
}

/**
 * MRP运算结果接口
 */
export interface MRPComputationResult {
  forecast_id: number;
  computation_time: string;
  total_materials: number;
  suggested_work_orders: number;
  suggested_purchase_orders: number;
  material_results: any[];
}

/**
 * MRP运算结果详情接口
 */
export interface MRPResult {
  id?: number;
  tenant_id?: number;
  forecast_id?: number;
  material_id?: number;
  planning_horizon?: number;
  time_bucket?: string;
  current_inventory?: number;
  safety_stock?: number;
  reorder_point?: number;
  total_gross_requirement?: number;
  total_net_requirement?: number;
  total_planned_receipt?: number;
  total_planned_release?: number;
  suggested_work_orders?: number;
  suggested_purchase_orders?: number;
  computation_status?: string;
  computation_time?: string;
  demand_schedule?: any;
  inventory_schedule?: any;
  planned_order_schedule?: any;
  // 关联的物料信息（从后端扩展）
  material_code?: string;
  material_name?: string;
}

/**
 * MRP运算结果列表参数
 */
export interface MRPResultListParams {
  skip?: number;
  limit?: number;
  forecast_id?: number;
}

/**
 * MRP运算结果列表响应
 */
export interface MRPResultListResponse {
  data: MRPResult[];
  total: number;
  success: boolean;
}

/**
 * 执行MRP运算
 */
export async function runMRPComputation(request: MRPComputationRequest): Promise<MRPComputationResult> {
  return apiRequest<MRPComputationResult>({
    url: '/apps/kuaizhizao/mrp-computation',
    method: 'POST',
    data: {
      forecast_id: request.forecast_id,
      planning_horizon: request.planning_horizon || 30,
      time_bucket: request.time_bucket || '周',
      include_safety_stock: request.include_safety_stock !== false,
      explosion_type: request.explosion_type || 'single_level',
    },
  });
}

/**
 * 获取MRP运算结果列表
 */
export async function listMRPResults(params: MRPResultListParams = {}): Promise<MRPResultListResponse> {
  return apiRequest<MRPResultListResponse>({
    url: '/apps/kuaizhizao/mrp/results',
    method: 'GET',
    params,
  });
}

/**
 * 获取MRP运算结果详情
 */
export async function getMRPResult(id: number): Promise<MRPResult> {
  return apiRequest<MRPResult>({
    url: `/apps/kuaizhizao/mrp/results/${id}`,
    method: 'GET',
  });
}

/**
 * 从MRP运算结果一键生成工单和采购单
 */
export interface GenerateOrdersRequest {
  generate_work_orders?: boolean;
  generate_purchase_orders?: boolean;
  selected_material_ids?: number[];
}

export interface GenerateOrdersResponse {
  forecast_id: number;
  generated_work_orders: number;
  generated_purchase_orders: number;
  work_orders: any[];
  purchase_orders: any[];
  message: string;
}

export async function generateOrdersFromMRP(
  forecastId: number,
  options: GenerateOrdersRequest = {}
): Promise<GenerateOrdersResponse> {
  const params: any = {
    generate_work_orders: options.generate_work_orders !== false,
    generate_purchase_orders: options.generate_purchase_orders !== false,
  };
  
  if (options.selected_material_ids && options.selected_material_ids.length > 0) {
    params.selected_material_ids = options.selected_material_ids;
  }
  
  return apiRequest<GenerateOrdersResponse>({
    url: `/apps/kuaizhizao/mrp/results/${forecastId}/generate-orders`,
    method: 'POST',
    params,
  });
}

/**
 * 导出MRP运算结果
 */
export async function exportMRPResults(forecastId?: number): Promise<Blob> {
  const params: any = {};
  if (forecastId) {
    params.forecast_id = forecastId;
  }
  
  return apiRequest<Blob>({
    url: '/apps/kuaizhizao/mrp/results/export',
    method: 'GET',
    params,
    responseType: 'blob',
  });
}

/**
 * 导出单个MRP运算结果
 */
export async function exportMRPResult(resultId: number): Promise<Blob> {
  return apiRequest<Blob>({
    url: `/apps/kuaizhizao/mrp/results/${resultId}/export`,
    method: 'GET',
    responseType: 'blob',
  });
}

/**
 * 获取销售预测列表（用于MRP运算选择）
 */
export async function getSalesForecastsForMRP(): Promise<SalesForecast[]> {
  const response = await listSalesForecasts({
    skip: 0,
    limit: 1000,
    status: '已审核',
  });
  return response.data || [];
}

