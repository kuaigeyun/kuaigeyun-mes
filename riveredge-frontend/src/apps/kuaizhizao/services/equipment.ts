/**
 * 设备管理相关服务
 *
 * 提供设备、维护保养计划、设备故障、模具等相关的API接口。
 *
 * Author: Luigi Lu
 * Date: 2026-01-05
 */

import { apiRequest } from '../../../services/api';

// 设备相关接口
export const equipmentApi = {
  // 获取设备列表
  list: async (params?: any) => {
    return apiRequest('/apps/kuaizhizao/equipment', { method: 'GET', params });
  },

  // 创建设备
  create: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/equipment', { method: 'POST', data });
  },

  // 更新设备
  update: async (uuid: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/equipment/${uuid}`, { method: 'PUT', data });
  },

  // 删除设备
  delete: async (uuid: string) => {
    return apiRequest(`/apps/kuaizhizao/equipment/${uuid}`, { method: 'DELETE' });
  },

  // 获取设备详情
  get: async (uuid: string) => {
    return apiRequest(`/apps/kuaizhizao/equipment/${uuid}`, { method: 'GET' });
  },

  // 获取设备使用记录追溯
  getTrace: async (uuid: string) => {
    return apiRequest(`/apps/kuaizhizao/equipment/${uuid}/trace`, { method: 'GET' });
  },

  // 创建设备校验记录
  createCalibration: async (equipmentUuid: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/equipment/${equipmentUuid}/calibrations`, { method: 'POST', data });
  },

  // 生成设备二维码
  generateQRCode: async (equipmentUuid: string, equipmentCode: string, equipmentName: string): Promise<any> => {
    const { qrcodeApi } = await import('../../../services/qrcode');
    return qrcodeApi.generateEquipment({
      equipment_uuid: equipmentUuid,
      equipment_code: equipmentCode,
      equipment_name: equipmentName,
    });
  },
};

// 维护保养计划相关接口
export const maintenancePlanApi = {
  // 获取维护保养计划列表
  list: async (params?: any) => {
    return apiRequest('/apps/kuaizhizao/maintenance-plans', { method: 'GET', params });
  },

  // 创建维护保养计划
  create: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/maintenance-plans', { method: 'POST', data });
  },

  // 更新维护保养计划
  update: async (uuid: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/maintenance-plans/${uuid}`, { method: 'PUT', data });
  },

  // 删除维护保养计划
  delete: async (uuid: string) => {
    return apiRequest(`/apps/kuaizhizao/maintenance-plans/${uuid}`, { method: 'DELETE' });
  },

  // 获取维护保养计划详情
  get: async (uuid: string) => {
    return apiRequest(`/apps/kuaizhizao/maintenance-plans/${uuid}`, { method: 'GET' });
  },

  // 执行维护保养
  execute: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/maintenance-plans/executions', { method: 'POST', data });
  },
};

// 设备故障相关接口
export const equipmentFaultApi = {
  // 获取设备故障列表
  list: async (params?: any) => {
    return apiRequest('/apps/kuaizhizao/equipment-faults', { method: 'GET', params });
  },

  // 记录设备故障
  create: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/equipment-faults', { method: 'POST', data });
  },

  // 更新设备故障
  update: async (uuid: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/equipment-faults/${uuid}`, { method: 'PUT', data });
  },

  // 删除设备故障
  delete: async (uuid: string) => {
    return apiRequest(`/apps/kuaizhizao/equipment-faults/${uuid}`, { method: 'DELETE' });
  },

  // 获取设备故障详情
  get: async (uuid: string) => {
    return apiRequest(`/apps/kuaizhizao/equipment-faults/${uuid}`, { method: 'GET' });
  },

  // 记录设备维修
  createRepair: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/equipment-faults/repairs', { method: 'POST', data });
  },
};

// 模具相关接口
export const moldApi = {
  // 获取模具列表
  list: async (params?: any) => {
    return apiRequest('/apps/kuaizhizao/molds', { method: 'GET', params });
  },

  // 创建模具
  create: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/molds', { method: 'POST', data });
  },

  // 更新模具
  update: async (uuid: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/molds/${uuid}`, { method: 'PUT', data });
  },

  // 删除模具
  delete: async (uuid: string) => {
    return apiRequest(`/apps/kuaizhizao/molds/${uuid}`, { method: 'DELETE' });
  },

  // 获取模具详情
  get: async (uuid: string) => {
    return apiRequest(`/apps/kuaizhizao/molds/${uuid}`, { method: 'GET' });
  },

  // 创建模具使用记录
  createUsage: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/molds/usages', { method: 'POST', data });
  },

  // 获取模具使用记录列表
  listUsages: async (params?: any) => {
    return apiRequest('/apps/kuaizhizao/molds/usages', { method: 'GET', params });
  },

  // 获取模具校验记录列表（mold_uuid 可选，不传则全量）
  listCalibrations: async (params?: { mold_uuid?: string; skip?: number; limit?: number }) => {
    return apiRequest('/apps/kuaizhizao/molds/calibrations', { method: 'GET', params });
  },

  // 创建模具校验记录
  createCalibration: async (data: { mold_uuid: string; calibration_date: string; result: string; certificate_no?: string; expiry_date?: string; remark?: string }) => {
    return apiRequest('/apps/kuaizhizao/molds/calibrations', { method: 'POST', data });
  },

  // 获取模具保养提醒列表
  listMaintenanceReminders: async (params?: { skip?: number; limit?: number; reminder_type?: string }) => {
    return apiRequest('/apps/kuaizhizao/molds/maintenance-reminders', { method: 'GET', params });
  },
};

// 工装相关接口
export const toolApi = {
  list: async (params?: any) => {
    return apiRequest('/apps/kuaizhizao/tools', { method: 'GET', params });
  },
  create: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/tools', { method: 'POST', data });
  },
  update: async (uuid: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/tools/${uuid}`, { method: 'PUT', data });
  },
  get: async (uuid: string) => {
    return apiRequest(`/apps/kuaizhizao/tools/${uuid}`, { method: 'GET' });
  },
  delete: async (uuid: string) => {
    return apiRequest(`/apps/kuaizhizao/tools/${uuid}`, { method: 'DELETE' });
  },
  listUsages: async (toolUuid: string, params?: { skip?: number; limit?: number }) => {
    return apiRequest(`/apps/kuaizhizao/tools/${toolUuid}/usages`, { method: 'GET', params });
  },
  listMaintenances: async (toolUuid: string, params?: { skip?: number; limit?: number }) => {
    return apiRequest(`/apps/kuaizhizao/tools/${toolUuid}/maintenances`, { method: 'GET', params });
  },
  listCalibrations: async (toolUuid: string, params?: { skip?: number; limit?: number }) => {
    return apiRequest(`/apps/kuaizhizao/tools/${toolUuid}/calibrations`, { method: 'GET', params });
  },
  // 全量列表（运营页面用）
  listAllUsages: async (params?: { tool_uuid?: string; status?: string; skip?: number; limit?: number }) => {
    return apiRequest('/apps/kuaizhizao/tools/usages', { method: 'GET', params });
  },
  listAllMaintenances: async (params?: { tool_uuid?: string; skip?: number; limit?: number }) => {
    return apiRequest('/apps/kuaizhizao/tools/maintenances', { method: 'GET', params });
  },
  listAllCalibrations: async (params?: { tool_uuid?: string; skip?: number; limit?: number }) => {
    return apiRequest('/apps/kuaizhizao/tools/calibrations', { method: 'GET', params });
  },
  listMaintenanceReminders: async (params?: { skip?: number; limit?: number; due_type?: string }) => {
    return apiRequest('/apps/kuaizhizao/tools/maintenance-reminders', { method: 'GET', params });
  },
  checkout: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/tools/checkout', { method: 'POST', data });
  },
  checkin: async (usageUuid: string, remark?: string) => {
    return apiRequest(`/apps/kuaizhizao/tools/checkin/${usageUuid}`, {
      method: 'POST',
      params: remark ? { remark } : undefined,
    });
  },
  recordMaintenance: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/tools/maintenances', { method: 'POST', data });
  },
  recordCalibration: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/tools/calibrations', { method: 'POST', data });
  },
};

// 设备状态监控相关接口
export const equipmentStatusApi = {
  // 获取设备实时状态列表
  getRealtimeStatus: async (params?: any) => {
    return apiRequest('/apps/kuaizhizao/equipment-status/realtime', { method: 'GET', params });
  },

  // 获取设备状态监控记录列表
  listMonitors: async (params?: any) => {
    return apiRequest('/apps/kuaizhizao/equipment-status/monitors', { method: 'GET', params });
  },

  // 创建设备状态监控记录
  createMonitor: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/equipment-status/monitors', { method: 'POST', data });
  },

  // 获取设备最新状态
  getLatestStatus: async (equipmentUuid: string) => {
    return apiRequest(`/apps/kuaizhizao/equipment-status/equipment/${equipmentUuid}/latest`, { method: 'GET' });
  },

  // 更新设备状态
  updateStatus: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/equipment-status/update', { method: 'POST', data });
  },

  // 获取设备状态历史
  getStatusHistory: async (equipmentUuid: string, params?: any) => {
    return apiRequest(`/apps/kuaizhizao/equipment-status/equipment/${equipmentUuid}/history`, { method: 'GET', params });
  },
};

// 设备维护提醒相关接口
export const maintenanceReminderApi = {
  // 获取维护提醒列表
  list: async (params?: any) => {
    return apiRequest('/apps/kuaizhizao/maintenance-reminders', { method: 'GET', params });
  },

  // 获取未读提醒数量
  getUnreadCount: async () => {
    return apiRequest('/apps/kuaizhizao/maintenance-reminders/unread-count', { method: 'GET' });
  },

  // 标记提醒为已读
  markAsRead: async (data: { reminder_uuids: string[] }) => {
    return apiRequest('/apps/kuaizhizao/maintenance-reminders/mark-read', { method: 'POST', data });
  },

  // 标记提醒为已处理
  markAsHandled: async (data: { reminder_uuid: string; remark?: string }) => {
    return apiRequest('/apps/kuaizhizao/maintenance-reminders/mark-handled', { method: 'POST', data });
  },

  // 手动检查维护计划
  checkMaintenancePlans: async (params?: { advance_days?: number }) => {
    return apiRequest('/apps/kuaizhizao/maintenance-reminders/check', { method: 'POST', params });
  },
};

