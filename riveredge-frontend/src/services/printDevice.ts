/**
 * 打印设备管理服务
 * 
 * 提供打印设备的 CRUD 操作和打印设备连接测试功能。
 * 注意：所有 API 自动过滤当前组织的打印设备
 */

import { apiRequest } from './api';

export interface PrintDevice {
  uuid: string;
  tenant_id: number;
  name: string;
  code: string;
  type: string;
  description?: string;
  config: Record<string, any>;
  is_active: boolean;
  is_default: boolean;
  is_online: boolean;
  inngest_function_id?: string;
  last_connected_at?: string;
  usage_count: number;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PrintDeviceListParams {
  skip?: number;
  limit?: number;
  type?: string;
  is_active?: boolean;
}

export interface CreatePrintDeviceData {
  name: string;
  code: string;
  type: string;
  description?: string;
  config: Record<string, any>;
}

export interface UpdatePrintDeviceData {
  name?: string;
  description?: string;
  config?: Record<string, any>;
  is_active?: boolean;
  is_default?: boolean;
}

export interface TestPrintDeviceData {
  test_content?: string;
}

export interface PrintDeviceTestResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface PrintDevicePrintData {
  template_uuid: string;
  data: Record<string, any>;
  async_execution?: boolean;
}

export interface PrintDevicePrintResponse {
  success: boolean;
  message?: string;
  error?: string;
  inngest_run_id?: string;
}

/**
 * 获取打印设备列表
 */
export async function getPrintDeviceList(params?: PrintDeviceListParams): Promise<PrintDevice[]> {
  return apiRequest<PrintDevice[]>('/core/print-devices', {
    params,
  });
}

/**
 * 获取打印设备详情
 */
export async function getPrintDeviceByUuid(printDeviceUuid: string): Promise<PrintDevice> {
  return apiRequest<PrintDevice>(`/core/print-devices/${printDeviceUuid}`);
}

/**
 * 创建打印设备
 */
export async function createPrintDevice(data: CreatePrintDeviceData): Promise<PrintDevice> {
  return apiRequest<PrintDevice>('/core/print-devices', {
    method: 'POST',
    data,
  });
}

/**
 * 更新打印设备
 */
export async function updatePrintDevice(printDeviceUuid: string, data: UpdatePrintDeviceData): Promise<PrintDevice> {
  return apiRequest<PrintDevice>(`/core/print-devices/${printDeviceUuid}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除打印设备
 */
export async function deletePrintDevice(printDeviceUuid: string): Promise<void> {
  return apiRequest<void>(`/core/print-devices/${printDeviceUuid}`, {
    method: 'DELETE',
  });
}

/**
 * 测试打印设备连接
 */
export async function testPrintDevice(printDeviceUuid: string, data?: TestPrintDeviceData): Promise<PrintDeviceTestResponse> {
  return apiRequest<PrintDeviceTestResponse>(`/core/print-devices/${printDeviceUuid}/test`, {
    method: 'POST',
    data: data || {},
  });
}

/**
 * 使用打印设备执行打印任务
 */
export async function printWithDevice(printDeviceUuid: string, data: PrintDevicePrintData): Promise<PrintDevicePrintResponse> {
  return apiRequest<PrintDevicePrintResponse>(`/core/print-devices/${printDeviceUuid}/print`, {
    method: 'POST',
    data,
  });
}

