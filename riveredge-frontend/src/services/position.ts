/**
 * 职位 API 服务
 * 
 * 提供职位管理相关的 API 接口
 * 注意：所有 API 自动过滤当前组织的职位
 */

import { apiRequest } from './api';

/**
 * 职位信息接口
 */
export interface Position {
  uuid: string;
  name: string;
  code?: string;
  description?: string;
  department_uuid?: string;
  department?: {
    uuid: string;
    name: string;
    code?: string;
  };
  sort_order: number;
  is_active: boolean;
  tenant_id: number;
  user_count?: number;
  created_at: string;
  updated_at: string;
}

/**
 * 职位列表查询参数
 */
export interface PositionListParams {
  page?: number;
  page_size?: number;
  keyword?: string;
  name?: string;
  code?: string;
  department_uuid?: string;
  is_active?: boolean;
}

/**
 * 职位列表响应数据
 */
export interface PositionListResponse {
  items: Position[];
  total: number;
  page: number;
  page_size: number;
}

/**
 * 创建职位数据
 */
export interface CreatePositionData {
  name: string;
  code?: string;
  description?: string;
  department_uuid?: string;
  sort_order?: number;
  is_active?: boolean;
}

/**
 * 更新职位数据
 */
export interface UpdatePositionData {
  name?: string;
  code?: string;
  description?: string;
  department_uuid?: string;
  sort_order?: number;
  is_active?: boolean;
}

/**
 * 获取职位列表
 * 
 * 自动过滤当前组织的职位。
 * 
 * @param params - 查询参数
 * @returns 职位列表响应数据
 */
export async function getPositionList(params?: PositionListParams): Promise<PositionListResponse> {
  return apiRequest<PositionListResponse>('/core/positions', {
    params,
  });
}

/**
 * 获取职位详情
 * 
 * 自动验证组织权限：只能获取当前组织的职位。
 * 
 * @param positionUuid - 职位 UUID
 * @returns 职位信息
 */
export async function getPositionByUuid(positionUuid: string): Promise<Position> {
  return apiRequest<Position>(`/core/positions/${positionUuid}`);
}

/**
 * 创建职位
 * 
 * 自动设置当前组织的 tenant_id。
 * 
 * @param data - 职位创建数据
 * @returns 创建的职位信息
 */
export async function createPosition(data: CreatePositionData): Promise<Position> {
  return apiRequest<Position>('/core/positions', {
    method: 'POST',
    data,
  });
}

/**
 * 更新职位
 * 
 * 自动验证组织权限：只能更新当前组织的职位。
 * 
 * @param positionUuid - 职位 UUID
 * @param data - 职位更新数据
 * @returns 更新后的职位信息
 */
export async function updatePosition(positionUuid: string, data: UpdatePositionData): Promise<Position> {
  return apiRequest<Position>(`/core/positions/${positionUuid}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除职位
 * 
 * 自动验证组织权限：只能删除当前组织的职位。
 * 有关联用户的职位不可删除。
 * 
 * @param positionUuid - 职位 UUID
 */
export async function deletePosition(positionUuid: string): Promise<void> {
  return apiRequest<void>(`/core/positions/${positionUuid}`, {
    method: 'DELETE',
  });
}

