/**
 * 设备 API 服务
 * 
 * 提供设备管理相关的 API 接口
 * 注意：所有 API 自动过滤当前组织的设备
 */

import { apiRequest } from './api';

/**
 * 设备信息接口
 */
export interface Equipment {
  uuid: string;
  code: string;
  name: string;
  type?: string;
  category?: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  manufacturer?: string;
  supplier?: string;
  purchase_date?: string;
  installation_date?: string;
  warranty_period?: number;
  technical_parameters?: Record<string, any>;
  workstation_id?: number;
  workstation_code?: string;
  workstation_name?: string;
  status: string;
  is_active: boolean;
  description?: string;
  tenant_id: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

/**
 * 设备列表查询参数
 */
export interface EquipmentListParams {
  skip?: number;
  limit?: number;
  type?: string;
  category?: string;
  status?: string;
  is_active?: boolean;
  workstation_id?: number;
  search?: string;
}

/**
 * 设备列表响应数据
 */
export interface EquipmentListResponse {
  items: Equipment[];
  total: number;
  skip: number;
  limit: number;
}

/**
 * 创建设备数据
 */
export interface CreateEquipmentData {
  code?: string;
  name: string;
  type?: string;
  category?: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  manufacturer?: string;
  supplier?: string;
  purchase_date?: string;
  installation_date?: string;
  warranty_period?: number;
  technical_parameters?: Record<string, any>;
  workstation_id?: number;
  workstation_code?: string;
  workstation_name?: string;
  status?: string;
  is_active?: boolean;
  description?: string;
}

/**
 * 更新设备数据
 */
export interface UpdateEquipmentData {
  code?: string;
  name?: string;
  type?: string;
  category?: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  manufacturer?: string;
  supplier?: string;
  purchase_date?: string;
  installation_date?: string;
  warranty_period?: number;
  technical_parameters?: Record<string, any>;
  workstation_id?: number;
  workstation_code?: string;
  workstation_name?: string;
  status?: string;
  is_active?: boolean;
  description?: string;
}

/**
 * 获取设备列表
 * 
 * 自动过滤当前组织的设备。
 * 
 * @param params - 查询参数
 * @returns 设备列表响应数据
 */
export async function getEquipmentList(params?: EquipmentListParams): Promise<EquipmentListResponse> {
  return apiRequest<EquipmentListResponse>('/apps/kuaizhizao/equipment', {
    params,
  });
}

/**
 * 获取设备详情
 * 
 * 自动验证组织权限：只能获取当前组织的设备。
 * 
 * @param equipmentUuid - 设备 UUID
 * @returns 设备信息
 */
export async function getEquipmentByUuid(equipmentUuid: string): Promise<Equipment> {
  return apiRequest<Equipment>(`/apps/kuaizhizao/equipment/${equipmentUuid}`);
}

/**
 * 创建设备
 * 
 * 自动设置当前组织的 tenant_id。
 * 
 * @param data - 设备创建数据
 * @returns 创建设备信息
 */
export async function createEquipment(data: CreateEquipmentData): Promise<Equipment> {
  return apiRequest<Equipment>('/apps/kuaizhizao/equipment', {
    method: 'POST',
    data,
  });
}

/**
 * 更新设备
 * 
 * 自动验证组织权限：只能更新当前组织的设备。
 * 
 * @param equipmentUuid - 设备 UUID
 * @param data - 设备更新数据
 * @returns 更新后的设备信息
 */
export async function updateEquipment(equipmentUuid: string, data: UpdateEquipmentData): Promise<Equipment> {
  return apiRequest<Equipment>(`/apps/kuaizhizao/equipment/${equipmentUuid}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除设备
 * 
 * 自动验证组织权限：只能删除当前组织的设备。
 * 
 * @param equipmentUuid - 设备 UUID
 */
export async function deleteEquipment(equipmentUuid: string): Promise<void> {
  return apiRequest<void>(`/apps/kuaizhizao/equipment/${equipmentUuid}`, {
    method: 'DELETE',
  });
}

