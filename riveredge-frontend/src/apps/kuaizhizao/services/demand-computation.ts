/**
 * 统一需求计算API服务
 *
 * 提供统一需求计算相关的API调用接口
 *
 * @author Luigi Lu
 * @date 2025-01-14
 */

import { apiRequest } from '../../../services/api';

/**
 * 需求计算接口定义
 */
export interface DemandComputation {
  id?: number;
  uuid?: string;
  tenant_id?: number;
  computation_code?: string;
  demand_id?: number;
  demand_code?: string;
  demand_type?: 'sales_forecast' | 'sales_order';
  business_mode?: 'MTS' | 'MTO';
  computation_type?: 'MRP' | 'LRP';
  computation_params?: Record<string, any>;
  computation_status?: string;
  computation_start_time?: string;
  computation_end_time?: string;
  computation_summary?: Record<string, any>;
  error_message?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  items?: DemandComputationItem[];
}

/**
 * 需求计算明细接口定义
 */
export interface DemandComputationItem {
  id?: number;
  computation_id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  material_unit?: string;
  required_quantity?: number;
  available_inventory?: number;
  net_requirement?: number;
  gross_requirement?: number;
  safety_stock?: number;
  reorder_point?: number;
  planned_receipt?: number;
  planned_release?: number;
  delivery_date?: string;
  planned_production?: number;
  planned_procurement?: number;
  production_start_date?: string;
  production_completion_date?: string;
  procurement_start_date?: string;
  procurement_completion_date?: string;
  bom_id?: number;
  bom_version?: string;
  suggested_work_order_quantity?: number;
  suggested_purchase_order_quantity?: number;
  detail_results?: Record<string, any>;
  notes?: string;
}

/**
 * 需求计算列表参数
 */
export interface DemandComputationListParams {
  skip?: number;
  limit?: number;
  demand_id?: number;
  computation_type?: 'MRP' | 'LRP';
  computation_status?: string;
}

/**
 * 需求计算列表响应
 */
export interface DemandComputationListResponse {
  data: DemandComputation[];
  total: number;
  success: boolean;
}

/**
 * 创建需求计算
 */
export async function createDemandComputation(data: Partial<DemandComputation>): Promise<DemandComputation> {
  return apiRequest<DemandComputation>({
    url: '/apps/kuaizhizao/demand-computations',
    method: 'POST',
    data,
  });
}

/**
 * 获取需求计算列表
 */
export async function listDemandComputations(params?: DemandComputationListParams): Promise<DemandComputationListResponse> {
  return apiRequest<DemandComputationListResponse>({
    url: '/apps/kuaizhizao/demand-computations',
    method: 'GET',
    params,
  });
}

/**
 * 获取需求计算详情
 */
export async function getDemandComputation(id: number, includeItems: boolean = true): Promise<DemandComputation> {
  return apiRequest<DemandComputation>({
    url: `/apps/kuaizhizao/demand-computations/${id}`,
    method: 'GET',
    params: { include_items: includeItems },
  });
}

/**
 * 执行需求计算
 */
export async function executeDemandComputation(id: number): Promise<DemandComputation> {
  return apiRequest<DemandComputation>({
    url: `/apps/kuaizhizao/demand-computations/${id}/execute`,
    method: 'POST',
  });
}

/**
 * 更新需求计算
 */
export async function updateDemandComputation(id: number, data: Partial<DemandComputation>): Promise<DemandComputation> {
  return apiRequest<DemandComputation>({
    url: `/apps/kuaizhizao/demand-computations/${id}`,
    method: 'PUT',
    data,
  });
}
