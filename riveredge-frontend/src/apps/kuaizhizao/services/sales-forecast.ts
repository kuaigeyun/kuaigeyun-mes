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
  forecast_type?: string;
  forecast_period?: string;
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
  /** 创建/更新提交的明细；详情/列表带行时也可能是读模型明细 */
  items?: SalesForecastItemCreatePayload[] | SalesForecastItem[];
  /** 本次操作是否已同步至关联需求（更新/审核接口返回） */
  demand_synced?: boolean;
  /** 与关联需求下推需求计算同进同退（列表/详情接口） */
  planning_pushed_to_computation?: boolean;
  planning_computation_id?: number;
  planning_computation_code?: string;
  lifecycle?: Record<string, unknown>;
  capabilities?: SalesForecastCapabilities;
}

export interface ActionCapability {
  allowed: boolean;
  reason?: string | null;
}

export interface SalesForecastCapabilities {
  update: ActionCapability;
  delete: ActionCapability;
  submit: ActionCapability;
  withdraw_submit: ActionCapability;
  approve: ActionCapability;
  reject: ActionCapability;
  revoke_approval: ActionCapability;
  print: ActionCapability;
  push_computation: ActionCapability;
}

/** 销售预测明细创建/更新单条 payload（与后端 SalesForecastItemCreate 一致） */
export interface SalesForecastItemCreatePayload {
  material_id: number;
  material_code: string;
  material_name: string;
  material_spec?: string;
  material_unit: string;
  forecast_quantity: number;
  forecast_date: string;
  historical_sales?: number;
  historical_period?: string;
  confidence_level?: number;
  forecast_method?: string;
  /** 属性（配置件专用，如 {"color":"red","size":"M"}） */
  variant_attributes?: Record<string, unknown>;
  notes?: string;
}

export interface SalesForecastItem {
  id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  material_unit?: string;
  component_type?: string;
  forecast_date?: string;
  forecast_quantity?: number;
  historical_sales?: number;
  historical_period?: string;
  confidence_level?: number;
  forecast_method?: string;
  /** 属性（配置件专用，如 {"color":"red","size":"M"}） */
  variant_attributes?: Record<string, unknown>;
  notes?: string;
}

export interface SalesForecastListParams {
  skip?: number;
  limit?: number;
  status?: string;
  forecast_period?: string;
  start_date?: string;
  end_date?: string;
  keyword?: string;
  include_items?: boolean;
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
  return apiRequest<SalesForecastListResponse>('/apps/kuaizhizao/sales-forecasts', { method: 'GET', params });
}

/**
 * 创建销售预测
 */
export async function createSalesForecast(data: SalesForecast): Promise<SalesForecast> {
  return apiRequest<SalesForecast>('/apps/kuaizhizao/sales-forecasts', { method: 'POST', data });
}

/**
 * 获取销售预测详情
 */
export async function getSalesForecast(id: number): Promise<SalesForecast> {
  return apiRequest<SalesForecast>(`/apps/kuaizhizao/sales-forecasts/${id}`, { method: 'GET' });
}

/**
 * 更新销售预测（可带 items，提供则覆盖全部明细）
 */
export async function updateSalesForecast(
  id: number,
  data: Partial<SalesForecast> & { items?: SalesForecastItemCreatePayload[] }
): Promise<SalesForecast> {
  return apiRequest<SalesForecast>(`/apps/kuaizhizao/sales-forecasts/${id}`, { method: 'PUT', data });
}

/**
 * 删除销售预测
 */
export async function deleteSalesForecast(id: number): Promise<void> {
  return apiRequest<void>(`/apps/kuaizhizao/sales-forecasts/${id}`, { method: 'DELETE' });
}

/**
 * 审核销售预测（不传 rejection_reason 则通过，传则驳回）
 */
export async function approveSalesForecast(id: number, rejection_reason?: string): Promise<SalesForecast> {
  return apiRequest<SalesForecast>(`/apps/kuaizhizao/sales-forecasts/${id}/approve`, {
    method: 'POST',
    params: rejection_reason != null ? { rejection_reason } : undefined,
  });
}

/**
 * 撤回销售预测审核（已审核 -> 待审核）
 */
export async function withdrawSalesForecastApproval(id: number): Promise<SalesForecast> {
  return apiRequest<SalesForecast>(`/apps/kuaizhizao/sales-forecasts/${id}/withdraw-approval`, {
    method: 'POST',
  });
}

/** 撤回提交（待审核 -> 草稿），走统一审核入口 */
export async function withdrawSalesForecast(id: number): Promise<SalesForecast> {
  return apiRequest<SalesForecast>(`/core/uni-audit/sales_forecast/${id}/withdraw`, {
    method: 'POST',
  });
}

/**
 * 获取销售预测明细
 */
export async function getSalesForecastItems(id: number): Promise<SalesForecastItem[]> {
  return apiRequest<SalesForecastItem[]>(`/apps/kuaizhizao/sales-forecasts/${id}/items`, { method: 'GET' });
}

/**
 * 提交销售预测
 */
export async function submitSalesForecast(id: number): Promise<SalesForecast> {
  return apiRequest<SalesForecast>(`/apps/kuaizhizao/sales-forecasts/${id}/submit`, { method: 'POST' });
}

/**
 * 下推到需求计算
 */
export async function pushSalesForecastToComputation(
  id: number,
  planning_horizon: number = 12,
  time_bucket: string = 'week'
): Promise<any> {
  return apiRequest<any>(`/apps/kuaizhizao/sales-forecasts/${id}/push-to-computation`, {
    method: 'POST',
    params: { planning_horizon, time_bucket },
  });
}

/** 兼容旧命名 */
export async function pushSalesForecastToMrp(
  id: number,
  planning_horizon: number = 12,
  time_bucket: string = 'week'
): Promise<any> {
  return pushSalesForecastToComputation(id, planning_horizon, time_bucket);
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
  return apiRequest('/apps/kuaizhizao/sales-forecasts/import', { method: 'POST', data: { data } });
}

/**
 * 批量导出销售预测
 */
export async function exportSalesForecasts(params?: SalesForecastListParams): Promise<Blob> {
  return apiRequest<Blob>('/apps/kuaizhizao/sales-forecasts/export', {
    method: 'GET',
    params,
    responseType: 'blob',
  });
}

/** 销售预测统计（用于指标卡片） */
export interface SalesForecastStatistics {
  /** 今日新增预测单数 */
  today_new_count: number;
  pending_review_count: number;
  in_progress_count: number;
  overdue_count: number;
  total_amount: number;
  trend_today_new?: { date: string; value: number }[];
  trend_today_amount?: { date: string; value: number }[];
  trend_pending_review?: { date: string; value: number }[];
  yesterday_today_new?: number;
  yesterday_pending_review?: number;
}

/** 获取销售预测统计 */
export async function getSalesForecastStatistics(): Promise<SalesForecastStatistics> {
  return apiRequest<SalesForecastStatistics>('/apps/kuaizhizao/sales-forecasts/statistics', {
    method: 'GET',
  });
}

/**
 * 单据关联已统一至 document-relation 服务，请使用 getDocumentRelations(documentType, documentId)
 * @deprecated 使用 document-relation.getDocumentRelations
 */

