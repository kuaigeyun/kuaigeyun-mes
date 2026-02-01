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
  // 物料来源信息（核心功能，新增）
  material_source_type?: 'Make' | 'Buy' | 'Phantom' | 'Outsource' | 'Configure';
  material_source_config?: Record<string, any>;
  source_validation_passed?: boolean;
  source_validation_errors?: string[];
}

/**
 * 需求计算列表参数
 */
export interface DemandComputationListParams {
  skip?: number;
  limit?: number;
  demand_id?: number;
  demand_code?: string;
  computation_code?: string;
  computation_type?: 'MRP' | 'LRP';
  computation_status?: string;
  business_mode?: 'MTS' | 'MTO';
  start_date?: string;
  end_date?: string;
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
  return apiRequest<DemandComputation>('/apps/kuaizhizao/demand-computations', {
    method: 'POST',
    data,
  });
}

/**
 * 获取需求计算列表
 */
export async function listDemandComputations(params?: DemandComputationListParams): Promise<DemandComputationListResponse> {
  return apiRequest<DemandComputationListResponse>('/apps/kuaizhizao/demand-computations', {
    method: 'GET',
    params,
  });
}

/**
 * 获取需求计算详情
 */
export async function getDemandComputation(id: number, includeItems: boolean = true): Promise<DemandComputation> {
  return apiRequest<DemandComputation>(`/apps/kuaizhizao/demand-computations/${id}`, {
    method: 'GET',
    params: { include_items: includeItems },
  });
}

/**
 * 执行需求计算
 */
export async function executeDemandComputation(id: number): Promise<DemandComputation> {
  return apiRequest<DemandComputation>(`/apps/kuaizhizao/demand-computations/${id}/execute`, {
    method: 'POST',
  });
}

/**
 * 更新需求计算
 */
export async function updateDemandComputation(id: number, data: Partial<DemandComputation>): Promise<DemandComputation> {
  return apiRequest<DemandComputation>(`/apps/kuaizhizao/demand-computations/${id}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 一键生成工单和采购单响应
 */
export interface GenerateOrdersResponse {
  computation_id: number;
  computation_code: string;
  work_orders: Array<{
    id: number;
    code: string;
    product_code: string;
    product_name: string;
    quantity: number;
  }>;
  purchase_orders: Array<{
    id: number;
    order_code: string;
    material_code: string;
    material_name: string;
    quantity: number;
  }>;
  work_order_count: number;
  purchase_order_count: number;
}

/**
 * 一键生成工单和采购单
 */
export async function generateOrdersFromComputation(id: number): Promise<GenerateOrdersResponse> {
  return apiRequest<GenerateOrdersResponse>(`/apps/kuaizhizao/demand-computations/${id}/generate-orders`, {
    method: 'POST',
  });
}

/**
 * 查询需求计算历史记录参数
 */
export interface ComputationHistoryParams {
  skip?: number;
  limit?: number;
  demand_id?: number;
  computation_type?: 'MRP' | 'LRP';
  start_date?: string;
  end_date?: string;
}

/**
 * 查询需求计算历史记录
 */
export async function listComputationHistory(params?: ComputationHistoryParams): Promise<DemandComputationListResponse> {
  return apiRequest<DemandComputationListResponse>('/apps/kuaizhizao/demand-computations/history', {
    method: 'GET',
    params,
  });
}

/**
 * 对比结果接口定义
 */
export interface ComputationCompareResult {
  computation1: {
    id: number;
    computation_code: string;
    computation_start_time?: string;
    computation_end_time?: string;
  };
  computation2: {
    id: number;
    computation_code: string;
    computation_start_time?: string;
    computation_end_time?: string;
  };
  basic_diff: {
    computation_type: {
      value1: string;
      value2: string;
      same: boolean;
    };
    computation_params: {
      value1: Record<string, any>;
      value2: Record<string, any>;
      same: boolean;
    };
    computation_summary: {
      value1: Record<string, any> | null;
      value2: Record<string, any> | null;
      same: boolean;
    };
  };
  items_diff: Array<{
    material_id: number;
    material_code: string;
    material_name: string;
    exists_in_both: boolean;
    only_in?: 'computation1' | 'computation2';
    differences?: Record<string, {
      value1: number | null;
      value2: number | null;
      diff: number | null;
    }>;
  }>;
  total_differences: number;
}

/**
 * 对比两个需求计算结果
 */
export async function compareComputations(id1: number, id2: number): Promise<ComputationCompareResult> {
  return apiRequest<ComputationCompareResult>('/apps/kuaizhizao/demand-computations/compare', {
    method: 'GET',
    params: {
      computation_id1: id1,
      computation_id2: id2,
    },
  });
}

/**
 * 物料来源信息接口定义
 */
export interface MaterialSourceInfo {
  material_id: number;
  material_code: string;
  material_name: string;
  source_type?: 'Make' | 'Buy' | 'Phantom' | 'Outsource' | 'Configure';
  source_config?: Record<string, any>;
  source_validation_passed: boolean;
  source_validation_errors?: string[];
}

/**
 * 物料来源信息响应接口
 */
export interface MaterialSourcesResponse {
  computation_id: number;
  computation_code: string;
  material_sources: MaterialSourceInfo[];
  total_count: number;
}

/**
 * 获取需求计算的物料来源信息
 */
export async function getMaterialSources(computationId: number): Promise<MaterialSourcesResponse> {
  return apiRequest<MaterialSourcesResponse>(`/apps/kuaizhizao/demand-computations/${computationId}/material-sources`, {
    method: 'GET',
  });
}

/**
 * 物料来源验证结果接口定义
 */
export interface MaterialSourceValidationResult {
  material_id: number;
  material_code: string;
  material_name: string;
  source_type?: string;
  validation_passed: boolean;
  errors: string[];
}

/**
 * 物料来源验证响应接口
 */
export interface MaterialSourceValidationResponse {
  computation_id: number;
  computation_code: string;
  all_passed: boolean;
  validation_results: MaterialSourceValidationResult[];
  total_count: number;
  passed_count: number;
  failed_count: number;
}

/**
 * 验证需求计算的物料来源配置
 */
export async function validateMaterialSources(computationId: number): Promise<MaterialSourceValidationResponse> {
  return apiRequest<MaterialSourceValidationResponse>(`/apps/kuaizhizao/demand-computations/${computationId}/validate-material-sources`, {
    method: 'POST',
  });
}
