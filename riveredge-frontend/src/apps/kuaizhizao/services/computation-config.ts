/**
 * 需求计算参数配置API服务
 *
 * 提供需求计算参数配置相关的API调用接口
 *
 * @author Luigi Lu
 * @date 2025-01-14
 */

import { apiRequest } from '../../../services/api';

/**
 * 计算参数配置接口定义
 */
export interface ComputationConfig {
  id?: number;
  uuid?: string;
  tenant_id?: number;
  config_code?: string;
  config_name?: string;
  config_scope?: 'global' | 'material' | 'warehouse' | 'material_warehouse';
  material_id?: number;
  material_code?: string;
  material_name?: string;
  warehouse_id?: number;
  warehouse_code?: string;
  warehouse_name?: string;
  computation_params?: Record<string, any>;
  is_template?: boolean;
  template_name?: string;
  is_active?: boolean;
  priority?: number;
  description?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: number;
  updated_by?: number;
}

/**
 * 计算参数配置列表参数
 */
export interface ComputationConfigListParams {
  skip?: number;
  limit?: number;
  config_scope?: 'global' | 'material' | 'warehouse' | 'material_warehouse';
  material_id?: number;
  warehouse_id?: number;
  is_template?: boolean;
  is_active?: boolean;
  keyword?: string;
}

/**
 * 计算参数配置列表响应
 */
export interface ComputationConfigListResponse {
  data: ComputationConfig[];
  total: number;
  success: boolean;
}

/**
 * 创建计算参数配置
 */
export async function createComputationConfig(data: Partial<ComputationConfig>): Promise<ComputationConfig> {
  return apiRequest<ComputationConfig>({
    url: '/apps/kuaizhizao/computation-configs',
    method: 'POST',
    data,
  });
}

/**
 * 获取计算参数配置列表
 */
export async function listComputationConfigs(params?: ComputationConfigListParams): Promise<ComputationConfigListResponse> {
  return apiRequest<ComputationConfigListResponse>({
    url: '/apps/kuaizhizao/computation-configs',
    method: 'GET',
    params,
  });
}

/**
 * 获取计算参数配置详情
 */
export async function getComputationConfig(id: number): Promise<ComputationConfig> {
  return apiRequest<ComputationConfig>({
    url: `/apps/kuaizhizao/computation-configs/${id}`,
    method: 'GET',
  });
}

/**
 * 更新计算参数配置
 */
export async function updateComputationConfig(id: number, data: Partial<ComputationConfig>): Promise<ComputationConfig> {
  return apiRequest<ComputationConfig>({
    url: `/apps/kuaizhizao/computation-configs/${id}`,
    method: 'PUT',
    data,
  });
}

/**
 * 删除计算参数配置
 */
export async function deleteComputationConfig(id: number): Promise<void> {
  return apiRequest<void>({
    url: `/apps/kuaizhizao/computation-configs/${id}`,
    method: 'DELETE',
  });
}

/**
 * 获取用于计算的参数配置
 */
export interface ComputationParamsResponse {
  success: boolean;
  params: Record<string, any>;
}

export async function getComputationParams(materialId?: number, warehouseId?: number): Promise<ComputationParamsResponse> {
  return apiRequest<ComputationParamsResponse>({
    url: '/apps/kuaizhizao/computation-configs/for-computation/params',
    method: 'GET',
    params: {
      material_id: materialId,
      warehouse_id: warehouseId,
    },
  });
}
