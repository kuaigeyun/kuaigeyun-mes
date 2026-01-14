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
  salesman_id?: number;
  salesman_name?: string;
  shipping_address?: string;
  shipping_method?: string;
  payment_terms?: string;
  source_id?: number;
  source_type?: string;
  source_code?: string;
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
  return apiRequest<DemandListResponse>({
    url: '/apps/kuaizhizao/demands',
    method: 'GET',
    params,
  });
}

/**
 * 获取需求详情
 */
export async function getDemand(id: number, includeItems: boolean = false): Promise<Demand> {
  return apiRequest<Demand>({
    url: `/apps/kuaizhizao/demands/${id}`,
    method: 'GET',
    params: { include_items: includeItems },
  });
}

/**
 * 创建需求
 */
export async function createDemand(data: Partial<Demand>): Promise<Demand> {
  return apiRequest<Demand>({
    url: '/apps/kuaizhizao/demands',
    method: 'POST',
    data,
  });
}

/**
 * 更新需求
 */
export async function updateDemand(id: number, data: Partial<Demand>): Promise<Demand> {
  return apiRequest<Demand>({
    url: `/apps/kuaizhizao/demands/${id}`,
    method: 'PUT',
    data,
  });
}

/**
 * 提交需求
 */
export async function submitDemand(id: number): Promise<Demand> {
  return apiRequest<Demand>({
    url: `/apps/kuaizhizao/demands/${id}/submit`,
    method: 'POST',
  });
}

/**
 * 审核通过需求
 */
export async function approveDemand(id: number): Promise<Demand> {
  return apiRequest<Demand>({
    url: `/apps/kuaizhizao/demands/${id}/approve`,
    method: 'POST',
  });
}

/**
 * 驳回需求
 */
export async function rejectDemand(id: number, rejectionReason: string): Promise<Demand> {
  return apiRequest<Demand>({
    url: `/apps/kuaizhizao/demands/${id}/reject`,
    method: 'POST',
    params: { rejection_reason: rejectionReason },
  });
}

/**
 * 添加需求明细
 */
export async function addDemandItem(demandId: number, data: Partial<DemandItem>): Promise<DemandItem> {
  return apiRequest<DemandItem>({
    url: `/apps/kuaizhizao/demands/${demandId}/items`,
    method: 'POST',
    data,
  });
}

/**
 * 更新需求明细
 */
export async function updateDemandItem(demandId: number, itemId: number, data: Partial<DemandItem>): Promise<DemandItem> {
  return apiRequest<DemandItem>({
    url: `/apps/kuaizhizao/demands/${demandId}/items/${itemId}`,
    method: 'PUT',
    data,
  });
}

/**
 * 删除需求明细
 */
export async function deleteDemandItem(demandId: number, itemId: number): Promise<void> {
  return apiRequest<void>({
    url: `/apps/kuaizhizao/demands/${demandId}/items/${itemId}`,
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
  return apiRequest<BatchCreateDemandsResponse>({
    url: '/apps/kuaizhizao/demands/batch',
    method: 'POST',
    data: demands,
  });
}
