/**
 * 维护保养计划 API 服务
 * 
 * 提供维护保养计划相关的 API 接口
 * 注意：所有 API 自动过滤当前组织的维护计划
 */

import { apiRequest } from './api';

/**
 * 维护计划信息接口
 */
export interface MaintenancePlan {
  uuid: string;
  plan_no: string;
  plan_name: string;
  equipment_uuid: string;
  equipment_id: number;
  equipment_name: string;
  plan_type: string;
  maintenance_type: string;
  cycle_type: string;
  cycle_value?: number;
  cycle_unit?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  responsible_person_id?: number;
  responsible_person_name?: string;
  status: string;
  remark?: string;
  tenant_id: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

/**
 * 维护执行记录信息接口
 */
export interface MaintenanceExecution {
  uuid: string;
  execution_no: string;
  maintenance_plan_id?: number;
  maintenance_plan_uuid?: string;
  equipment_id: number;
  equipment_uuid: string;
  equipment_name: string;
  execution_date: string;
  executor_id?: number;
  executor_name?: string;
  execution_content?: string;
  execution_result?: string;
  maintenance_cost?: number;
  spare_parts_used?: Record<string, any>;
  status: string;
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
 * 维护计划列表查询参数
 */
export interface MaintenancePlanListParams {
  skip?: number;
  limit?: number;
  equipment_uuid?: string;
  status?: string;
  plan_type?: string;
  search?: string;
}

/**
 * 维护计划列表响应数据
 */
export interface MaintenancePlanListResponse {
  items: MaintenancePlan[];
  total: number;
  skip: number;
  limit: number;
}

/**
 * 维护执行记录列表查询参数
 */
export interface MaintenanceExecutionListParams {
  skip?: number;
  limit?: number;
  equipment_uuid?: string;
  maintenance_plan_uuid?: string;
  status?: string;
  search?: string;
}

/**
 * 维护执行记录列表响应数据
 */
export interface MaintenanceExecutionListResponse {
  items: MaintenanceExecution[];
  total: number;
  skip: number;
  limit: number;
}

/**
 * 创建维护计划数据
 */
export interface CreateMaintenancePlanData {
  plan_no?: string;
  plan_name: string;
  equipment_uuid: string;
  plan_type: string;
  maintenance_type: string;
  cycle_type: string;
  cycle_value?: number;
  cycle_unit?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  responsible_person_id?: number;
  responsible_person_name?: string;
  status?: string;
  remark?: string;
}

/**
 * 更新维护计划数据
 */
export interface UpdateMaintenancePlanData {
  plan_name?: string;
  plan_type?: string;
  maintenance_type?: string;
  cycle_type?: string;
  cycle_value?: number;
  cycle_unit?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  responsible_person_id?: number;
  responsible_person_name?: string;
  status?: string;
  remark?: string;
}

/**
 * 创建维护执行记录数据
 */
export interface CreateMaintenanceExecutionData {
  execution_no?: string;
  maintenance_plan_uuid?: string;
  equipment_uuid: string;
  execution_date: string;
  executor_id?: number;
  executor_name?: string;
  execution_content?: string;
  execution_result?: string;
  maintenance_cost?: number;
  spare_parts_used?: Record<string, any>;
  status?: string;
  acceptance_person_id?: number;
  acceptance_person_name?: string;
  acceptance_date?: string;
  acceptance_result?: string;
  remark?: string;
}

/**
 * 更新维护执行记录数据
 */
export interface UpdateMaintenanceExecutionData {
  execution_date?: string;
  executor_id?: number;
  executor_name?: string;
  execution_content?: string;
  execution_result?: string;
  maintenance_cost?: number;
  spare_parts_used?: Record<string, any>;
  status?: string;
  acceptance_person_id?: number;
  acceptance_person_name?: string;
  acceptance_date?: string;
  acceptance_result?: string;
  remark?: string;
}

/**
 * 获取维护计划列表
 * 
 * 自动过滤当前组织的维护计划。
 * 
 * @param params - 查询参数
 * @returns 维护计划列表响应数据
 */
export async function getMaintenancePlanList(params?: MaintenancePlanListParams): Promise<MaintenancePlanListResponse> {
  return apiRequest<MaintenancePlanListResponse>('/apps/kuaizhizao/maintenance-plans', {
    params,
  });
}

/**
 * 获取维护计划详情
 * 
 * 自动验证组织权限：只能获取当前组织的维护计划。
 * 
 * @param maintenancePlanUuid - 维护计划 UUID
 * @returns 维护计划信息
 */
export async function getMaintenancePlanByUuid(maintenancePlanUuid: string): Promise<MaintenancePlan> {
  return apiRequest<MaintenancePlan>(`/apps/kuaizhizao/maintenance-plans/${maintenancePlanUuid}`);
}

/**
 * 创建维护计划
 * 
 * 自动设置当前组织的 tenant_id。
 * 
 * @param data - 维护计划创建数据
 * @returns 创建的维护计划信息
 */
export async function createMaintenancePlan(data: CreateMaintenancePlanData): Promise<MaintenancePlan> {
  return apiRequest<MaintenancePlan>('/apps/kuaizhizao/maintenance-plans', {
    method: 'POST',
    data,
  });
}

/**
 * 更新维护计划
 * 
 * 自动验证组织权限：只能更新当前组织的维护计划。
 * 
 * @param maintenancePlanUuid - 维护计划 UUID
 * @param data - 维护计划更新数据
 * @returns 更新后的维护计划信息
 */
export async function updateMaintenancePlan(maintenancePlanUuid: string, data: UpdateMaintenancePlanData): Promise<MaintenancePlan> {
  return apiRequest<MaintenancePlan>(`/apps/kuaizhizao/maintenance-plans/${maintenancePlanUuid}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除维护计划
 * 
 * 自动验证组织权限：只能删除当前组织的维护计划。
 * 
 * @param maintenancePlanUuid - 维护计划 UUID
 */
export async function deleteMaintenancePlan(maintenancePlanUuid: string): Promise<void> {
  return apiRequest<void>(`/apps/kuaizhizao/maintenance-plans/${maintenancePlanUuid}`, {
    method: 'DELETE',
  });
}

/**
 * 获取维护执行记录列表
 * 
 * 自动过滤当前组织的维护执行记录。
 * 
 * @param params - 查询参数
 * @returns 维护执行记录列表响应数据
 */
export async function getMaintenanceExecutionList(params?: MaintenanceExecutionListParams): Promise<MaintenanceExecutionListResponse> {
  return apiRequest<MaintenanceExecutionListResponse>('/apps/kuaizhizao/maintenance-plans/executions', {
    params,
  });
}

/**
 * 获取维护执行记录详情
 * 
 * 自动验证组织权限：只能获取当前组织的维护执行记录。
 * 
 * @param executionUuid - 维护执行记录 UUID
 * @returns 维护执行记录信息
 */
export async function getMaintenanceExecutionByUuid(executionUuid: string): Promise<MaintenanceExecution> {
  return apiRequest<MaintenanceExecution>(`/apps/kuaizhizao/maintenance-plans/executions/${executionUuid}`);
}

/**
 * 创建维护执行记录
 * 
 * 自动设置当前组织的 tenant_id。
 * 
 * @param data - 维护执行记录创建数据
 * @returns 创建的维护执行记录信息
 */
export async function createMaintenanceExecution(data: CreateMaintenanceExecutionData): Promise<MaintenanceExecution> {
  return apiRequest<MaintenanceExecution>('/apps/kuaizhizao/maintenance-plans/executions', {
    method: 'POST',
    data,
  });
}

/**
 * 更新维护执行记录
 * 
 * 自动验证组织权限：只能更新当前组织的维护执行记录。
 * 
 * @param executionUuid - 维护执行记录 UUID
 * @param data - 维护执行记录更新数据
 * @returns 更新后的维护执行记录信息
 */
export async function updateMaintenanceExecution(executionUuid: string, data: UpdateMaintenanceExecutionData): Promise<MaintenanceExecution> {
  return apiRequest<MaintenanceExecution>(`/apps/kuaizhizao/maintenance-plans/executions/${executionUuid}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除维护执行记录
 * 
 * 自动验证组织权限：只能删除当前组织的维护执行记录。
 * 
 * @param executionUuid - 维护执行记录 UUID
 */
export async function deleteMaintenanceExecution(executionUuid: string): Promise<void> {
  return apiRequest<void>(`/apps/kuaizhizao/maintenance-plans/executions/${executionUuid}`, {
    method: 'DELETE',
  });
}

