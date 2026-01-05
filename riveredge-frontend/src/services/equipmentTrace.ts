/**
 * 设备使用记录追溯 API 服务
 * 
 * 提供设备使用记录追溯相关的 API 接口
 */

import { apiRequest } from './api';

/**
 * 设备追溯信息接口
 */
export interface EquipmentTrace {
  equipment: {
    uuid: string;
    code: string;
    name: string;
    status: string;
  };
  maintenance_plans: Array<{
    uuid: string;
    plan_no: string;
    plan_name: string;
    plan_type: string;
    maintenance_type: string;
    status: string;
    planned_start_date?: string;
    planned_end_date?: string;
    created_at: string;
  }>;
  maintenance_executions: Array<{
    uuid: string;
    execution_no: string;
    execution_date: string;
    executor_name?: string;
    execution_result?: string;
    status: string;
    created_at: string;
  }>;
  equipment_faults: Array<{
    uuid: string;
    fault_no: string;
    fault_date: string;
    fault_type: string;
    fault_level: string;
    status: string;
    created_at: string;
  }>;
  equipment_repairs: Array<{
    uuid: string;
    repair_no: string;
    repair_date: string;
    repair_type: string;
    repair_cost?: number;
    status: string;
    created_at: string;
  }>;
  usage_history: Array<any>; // TODO: 定义使用历史数据结构
}

/**
 * 获取设备使用记录追溯
 * 
 * 获取设备的使用历史、维护历史、故障历史、维修历史。
 * 
 * @param equipmentUuid - 设备 UUID
 * @returns 设备追溯信息
 */
export async function getEquipmentTrace(equipmentUuid: string): Promise<EquipmentTrace> {
  return apiRequest<EquipmentTrace>(`/core/equipment/${equipmentUuid}/trace`);
}

