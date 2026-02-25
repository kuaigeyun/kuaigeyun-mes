/**
 * 统一需求管理API服务
 *
 * 提供统一需求管理相关的API调用接口，支持销售预测和销售订单两种需求类型。
 *
 * @author Luigi Lu
 * @date 2025-01-14
 */

import { apiRequest } from '../../../services/api';

/**
 * 统一需求接口定义
 */
export enum DemandStatus {
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  AUDITED = 'AUDITED',
  REJECTED = 'REJECTED',
  CONFIRMED = 'CONFIRMED'
}

export enum ReviewStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export interface Demand {
  id?: number;
  uuid?: string;
  tenant_id?: number;
  demand_code?: string;
  demand_type?: 'sales_forecast' | 'sales_order';
  demand_name?: string;
  business_mode?: 'MTS' | 'MTO';
  start_date?: string;
  end_date?: string;
  customer_id?: number;
  customer_name?: string;
  customer_contact?: string;
  customer_phone?: string;
  forecast_period?: string;
  order_date?: string;
  delivery_date?: string;
  total_quantity?: number;
  total_amount?: number;
  status?: string;
  reviewer_id?: number;
  reviewer_name?: string;
  review_time?: string;
  review_status?: string;
  review_remarks?: string;
  submit_time?: string;
  salesman_id?: number;
  salesman_name?: string;
  shipping_address?: string;
  shipping_method?: string;
  payment_terms?: string;
  source_id?: number;
  source_type?: string;
  source_code?: string;
  priority?: number;
  pushed_to_computation?: boolean;
  computation_id?: number;
  computation_code?: string;
  notes?: string;
  is_active?: boolean;
  created_by?: number;
  updated_by?: number;
  created_at?: string;
  updated_at?: string;
  items?: DemandItem[];
  /** 生命周期（后端计算，列表/详情接口返回，供 UniLifecycleStepper 展示） */
  lifecycle?: {
    current_stage_key?: string;
    current_stage_name?: string;
    status?: 'success' | 'exception' | 'normal' | 'active';
    main_stages?: { key: string; label: string; status: 'done' | 'active' | 'pending' }[];
    sub_stages?: { key: string; label: string; status: 'done' | 'active' | 'pending' }[];
  };
  duration_info?: {
    created_at?: string;
    submit_time?: string;
    review_time?: string;
    duration_to_submit?: number | null;
    duration_to_review?: number | null;
    duration_submit_to_review?: number | null;
  };
}

/**
 * 统一需求明细接口定义
 */
export interface DemandItem {
  id?: number;
  uuid?: string;
  tenant_id?: number;
  demand_id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  material_unit?: string;
  required_quantity?: number;
  forecast_date?: string;
  forecast_month?: string;
  historical_sales?: number;
  historical_period?: string;
  confidence_level?: number;
  forecast_method?: string;
  delivery_date?: string;
  delivered_quantity?: number;
  remaining_quantity?: number;
  unit_price?: number;
  item_amount?: number;
  delivery_status?: string;
  work_order_id?: number;
  work_order_code?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * 需求列表查询参数
 */
export interface DemandListParams {
  skip?: number;
  limit?: number;
  demand_type?: 'sales_forecast' | 'sales_order';
  status?: string;
  pushed_to_computation?: boolean;
  business_mode?: 'MTS' | 'MTO';
  review_status?: string;
  start_date?: string;
  end_date?: string;
}

/**
 * 需求列表响应
 */
export interface DemandListResponse {
  data: Demand[];
  total: number;
  success: boolean;
}

/**
 * 获取需求列表
 */
export async function listDemands(params: DemandListParams = {}): Promise<DemandListResponse> {
  return apiRequest<DemandListResponse>('/apps/kuaizhizao/demands', {
    method: 'GET',
    params,
  });
}

/**
 * 获取需求详情
 */
export async function getDemand(id: number, includeItems: boolean = false, includeDuration: boolean = false): Promise<Demand & { duration_info?: any }> {
  return apiRequest<Demand & { duration_info?: any }>(`/apps/kuaizhizao/demands/${id}`, {
    method: 'GET',
    params: { include_items: includeItems, include_duration: includeDuration },
  });
}

/**
 * 创建需求
 */
export async function createDemand(data: Partial<Demand>): Promise<Demand> {
  return apiRequest<Demand>('/apps/kuaizhizao/demands', {
    method: 'POST',
    data,
  });
}

/**
 * 更新需求
 */
export async function updateDemand(id: number, data: Partial<Demand>): Promise<Demand> {
  return apiRequest<Demand>(`/apps/kuaizhizao/demands/${id}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 提交需求
 */
export async function submitDemand(id: number): Promise<Demand> {
  return apiRequest<Demand>(`/apps/kuaizhizao/demands/${id}/submit`, {
    method: 'POST',
  });
}

/**
 * 审核通过需求
 */
export async function approveDemand(id: number): Promise<Demand> {
  return apiRequest<Demand>(`/apps/kuaizhizao/demands/${id}/approve`, {
    method: 'POST',
  });
}

/**
 * 驳回需求
 */
export async function rejectDemand(id: number, rejectionReason: string): Promise<Demand> {
  return apiRequest<Demand>(`/apps/kuaizhizao/demands/${id}/reject`, {
    method: 'POST',
    params: { rejection_reason: rejectionReason },
  });
}

/**
 * 添加需求明细
 */
export async function addDemandItem(demandId: number, data: Partial<DemandItem>): Promise<DemandItem> {
  return apiRequest<DemandItem>(`/apps/kuaizhizao/demands/${demandId}/items`, {
    method: 'POST',
    data,
  });
}

/**
 * 更新需求明细
 */
export async function updateDemandItem(demandId: number, itemId: number, data: Partial<DemandItem>): Promise<DemandItem> {
  return apiRequest<DemandItem>(`/apps/kuaizhizao/demands/${demandId}/items/${itemId}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除需求明细
 */
export async function deleteDemandItem(demandId: number, itemId: number): Promise<void> {
  return apiRequest<void>(`/apps/kuaizhizao/demands/${demandId}/items/${itemId}`, {
    method: 'DELETE',
  });
}

/**
 * 批量创建需求响应
 */
export interface BatchCreateDemandsResponse {
  success: boolean;
  success_count: number;
  failure_count: number;
  errors: Array<{
    row: number;
    error: string;
    data: any;
  }>;
  created_demands: Demand[];
}

/**
 * 批量创建需求
 */
export async function batchCreateDemands(demands: Partial<Demand>[]): Promise<BatchCreateDemandsResponse> {
  return apiRequest<BatchCreateDemandsResponse>('/apps/kuaizhizao/demands/batch', {
    method: 'POST',
    data: demands,
  });
}

/**
 * 下推需求到物料需求运算响应
 */
export interface PushToComputationResponse {
  success: boolean;
  message: string;
  demand_code: string;
  computation_code: string;
  note?: string;
}

/**
 * 下推需求到物料需求运算
 */
export async function pushDemandToComputation(demandId: number): Promise<PushToComputationResponse> {
  return apiRequest<PushToComputationResponse>(`/apps/kuaizhizao/demands/${demandId}/push-to-computation`, {
    method: 'POST',
  });
}

/** 需求重算历史项（与后端 list_demand_recalc_history 返回一致） */
export interface DemandRecalcHistoryItem {
  id: number;
  recalc_at?: string;
  trigger_type?: string;
  source_type?: string;
  source_id?: number;
  trigger_reason?: string;
  snapshot_id?: number;
  operator_id?: number;
  result?: string;
  message?: string;
}

/** 需求快照项（与后端 list_demand_snapshots 返回一致） */
export interface DemandSnapshotItem {
  id: number;
  snapshot_type?: string;
  snapshot_at?: string;
  trigger_reason?: string;
  demand_snapshot?: Record<string, any>;
  demand_items_snapshot?: any[];
}

/**
 * 获取需求重算历史列表
 */
export async function listDemandRecalcHistory(
  demandId: number,
  params?: { limit?: number }
): Promise<DemandRecalcHistoryItem[]> {
  return apiRequest<DemandRecalcHistoryItem[]>(`/apps/kuaizhizao/demands/${demandId}/recalc-history`, {
    method: 'GET',
    params,
  });
}

/**
 * 获取需求快照列表
 */
export async function listDemandSnapshots(
  demandId: number,
  params?: { limit?: number }
): Promise<DemandSnapshotItem[]> {
  return apiRequest<DemandSnapshotItem[]>(`/apps/kuaizhizao/demands/${demandId}/snapshots`, {
    method: 'GET',
    params,
  });
}

/** 清理孤儿需求接口返回 */
export interface CleanOrphanDemandsResponse {
  cleaned_count: number;
  demand_ids: number[];
}

/**
 * 清理孤儿需求（直接物理删除：来源单据已删除的需求）
 */
export async function cleanOrphanDemands(): Promise<CleanOrphanDemandsResponse> {
  return apiRequest<CleanOrphanDemandsResponse>('/apps/kuaizhizao/demands/clean-orphans', {
    method: 'POST',
  });
}
