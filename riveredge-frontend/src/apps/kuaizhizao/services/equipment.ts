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
};

