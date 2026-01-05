/**
 * 设备故障维修 API 服务
 * 
 * 提供设备故障和维修记录相关的 API 接口
 * 注意：所有 API 自动过滤当前组织的故障和维修记录
 */

import { apiRequest } from './api';

/**
 * 设备故障记录信息接口
 */
export interface EquipmentFault {
  uuid: string;
  fault_no: string;
  equipment_uuid: string;
  equipment_id: number;
  equipment_name: string;
  fault_date: string;
  fault_type: string;
  fault_description: string;
  fault_level: string;
  reporter_id?: number;
  reporter_name?: string;
  status: string;
  repair_required: boolean;
  remark?: string;
  tenant_id: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

/**
 * 设备维修记录信息接口
 */
export interface EquipmentRepair {
  uuid: string;
  repair_no: string;
  equipment_fault_id?: number;
  equipment_fault_uuid?: string;
  equipment_id: number;
  equipment_uuid: string;
  equipment_name: string;
  repair_date: string;
  repair_type: string;
  repair_description?: string;
  repair_cost?: number;
  spare_parts_used?: Record<string, any>;
  repair_person_id?: number;
  repair_person_name?: string;
  status: string;
  completion_date?: string;
  acceptance_person_id?: number;
  acceptance_person_name?: string;
  acceptance_date?: string;
  acceptance_result?: string;
  remark?: string;
  tenant_id: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

/**
 * 设备故障记录列表查询参数
 */
export interface EquipmentFaultListParams {
  skip?: number;
  limit?: number;
  equipment_uuid?: string;
  status?: string;
  fault_type?: string;
  search?: string;
}

/**
 * 设备故障记录列表响应数据
 */
export interface EquipmentFaultListResponse {
  items: EquipmentFault[];
  total: number;
  skip: number;
  limit: number;
}

/**
 * 设备维修记录列表查询参数
 */
export interface EquipmentRepairListParams {
  skip?: number;
  limit?: number;
  equipment_uuid?: string;
  equipment_fault_uuid?: string;
  status?: string;
  search?: string;
}

/**
 * 设备维修记录列表响应数据
 */
export interface EquipmentRepairListResponse {
  items: EquipmentRepair[];
  total: number;
  skip: number;
  limit: number;
}

/**
 * 创建设备故障记录数据
 */
export interface CreateEquipmentFaultData {
  fault_no?: string;
  equipment_uuid: string;
  fault_date: string;
  fault_type: string;
  fault_description: string;
  fault_level: string;
  reporter_id?: number;
  reporter_name?: string;
  status?: string;
  repair_required?: boolean;
  remark?: string;
}

/**
 * 更新设备故障记录数据
 */
export interface UpdateEquipmentFaultData {
  fault_date?: string;
  fault_type?: string;
  fault_description?: string;
  fault_level?: string;
  reporter_id?: number;
  reporter_name?: string;
  status?: string;
  repair_required?: boolean;
  remark?: string;
}

/**
 * 创建设备维修记录数据
 */
export interface CreateEquipmentRepairData {
  repair_no?: string;
  equipment_fault_uuid?: string;
  equipment_uuid: string;
  repair_date: string;
  repair_type: string;
  repair_description?: string;
  repair_cost?: number;
  spare_parts_used?: Record<string, any>;
  repair_person_id?: number;
  repair_person_name?: string;
  status?: string;
  completion_date?: string;
  acceptance_person_id?: number;
  acceptance_person_name?: string;
  acceptance_date?: string;
  acceptance_result?: string;
  remark?: string;
}

/**
 * 更新设备维修记录数据
 */
export interface UpdateEquipmentRepairData {
  repair_date?: string;
  repair_type?: string;
  repair_description?: string;
  repair_cost?: number;
  spare_parts_used?: Record<string, any>;
  repair_person_id?: number;
  repair_person_name?: string;
  status?: string;
  completion_date?: string;
  acceptance_person_id?: number;
  acceptance_person_name?: string;
  acceptance_date?: string;
  acceptance_result?: string;
  remark?: string;
}

/**
 * 获取设备故障记录列表
 * 
 * 自动过滤当前组织的故障记录。
 * 
 * @param params - 查询参数
 * @returns 设备故障记录列表响应数据
 */
export async function getEquipmentFaultList(params?: EquipmentFaultListParams): Promise<EquipmentFaultListResponse> {
  return apiRequest<EquipmentFaultListResponse>('/apps/kuaizhizao/equipment-faults', {
    params,
  });
}

/**
 * 获取设备故障记录详情
 * 
 * 自动验证组织权限：只能获取当前组织的故障记录。
 * 
 * @param faultUuid - 设备故障记录 UUID
 * @returns 设备故障记录信息
 */
export async function getEquipmentFaultByUuid(faultUuid: string): Promise<EquipmentFault> {
  return apiRequest<EquipmentFault>(`/apps/kuaizhizao/equipment-faults/${faultUuid}`);
}

/**
 * 创建设备故障记录
 * 
 * 自动设置当前组织的 tenant_id。
 * 
 * @param data - 设备故障记录创建数据
 * @returns 创建的设备故障记录信息
 */
export async function createEquipmentFault(data: CreateEquipmentFaultData): Promise<EquipmentFault> {
  return apiRequest<EquipmentFault>('/apps/kuaizhizao/equipment-faults', {
    method: 'POST',
    data,
  });
}

/**
 * 更新设备故障记录
 * 
 * 自动验证组织权限：只能更新当前组织的故障记录。
 * 
 * @param faultUuid - 设备故障记录 UUID
 * @param data - 设备故障记录更新数据
 * @returns 更新后的设备故障记录信息
 */
export async function updateEquipmentFault(faultUuid: string, data: UpdateEquipmentFaultData): Promise<EquipmentFault> {
  return apiRequest<EquipmentFault>(`/apps/kuaizhizao/equipment-faults/${faultUuid}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除设备故障记录
 * 
 * 自动验证组织权限：只能删除当前组织的故障记录。
 * 
 * @param faultUuid - 设备故障记录 UUID
 */
export async function deleteEquipmentFault(faultUuid: string): Promise<void> {
  return apiRequest<void>(`/apps/kuaizhizao/equipment-faults/${faultUuid}`, {
    method: 'DELETE',
  });
}

/**
 * 获取设备维修记录列表
 * 
 * 自动过滤当前组织的维修记录。
 * 
 * @param params - 查询参数
 * @returns 设备维修记录列表响应数据
 */
export async function getEquipmentRepairList(params?: EquipmentRepairListParams): Promise<EquipmentRepairListResponse> {
  return apiRequest<EquipmentRepairListResponse>('/apps/kuaizhizao/equipment-faults/repairs', {
    params,
  });
}

/**
 * 获取设备维修记录详情
 * 
 * 自动验证组织权限：只能获取当前组织的维修记录。
 * 
 * @param repairUuid - 设备维修记录 UUID
 * @returns 设备维修记录信息
 */
export async function getEquipmentRepairByUuid(repairUuid: string): Promise<EquipmentRepair> {
  return apiRequest<EquipmentRepair>(`/apps/kuaizhizao/equipment-faults/repairs/${repairUuid}`);
}

/**
 * 创建设备维修记录
 * 
 * 自动设置当前组织的 tenant_id。
 * 
 * @param data - 设备维修记录创建数据
 * @returns 创建的设备维修记录信息
 */
export async function createEquipmentRepair(data: CreateEquipmentRepairData): Promise<EquipmentRepair> {
  return apiRequest<EquipmentRepair>('/apps/kuaizhizao/equipment-faults/repairs', {
    method: 'POST',
    data,
  });
}

/**
 * 更新设备维修记录
 * 
 * 自动验证组织权限：只能更新当前组织的维修记录。
 * 
 * @param repairUuid - 设备维修记录 UUID
 * @param data - 设备维修记录更新数据
 * @returns 更新后的设备维修记录信息
 */
export async function updateEquipmentRepair(repairUuid: string, data: UpdateEquipmentRepairData): Promise<EquipmentRepair> {
  return apiRequest<EquipmentRepair>(`/apps/kuaizhizao/equipment-faults/repairs/${repairUuid}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除设备维修记录
 * 
 * 自动验证组织权限：只能删除当前组织的维修记录。
 * 
 * @param repairUuid - 设备维修记录 UUID
 */
export async function deleteEquipmentRepair(repairUuid: string): Promise<void> {
  return apiRequest<void>(`/apps/kuaizhizao/equipment-faults/repairs/${repairUuid}`, {
    method: 'DELETE',
  });
}

