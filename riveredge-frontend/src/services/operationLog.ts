/**
 * 操作日志管理服务
 * 
 * 提供操作日志的查询和统计功能。
 */

import { apiRequest } from './api';

export interface OperationLog {
  uuid: string;
  tenant_id: number;
  user_id: number;
  operation_type: string;
  operation_module?: string;
  operation_object_type?: string;
  operation_object_id?: number;
  operation_object_uuid?: string;
  operation_content?: string;
  ip_address?: string;
  user_agent?: string;
  request_method?: string;
  request_path?: string;
  created_at: string;
}

export interface OperationLogListResponse {
  items: OperationLog[];
  total: number;
  page: number;
  page_size: number;
}

export interface OperationLogStats {
  total: number;
  by_type: Record<string, number>;
  by_module: Record<string, number>;
}

/**
 * 获取操作日志列表
 */
export async function getOperationLogs(params?: {
  page?: number;
  page_size?: number;
  user_id?: number;
  operation_type?: string;
  operation_module?: string;
  operation_object_type?: string;
  start_time?: string;
  end_time?: string;
}): Promise<OperationLogListResponse> {
  return apiRequest<OperationLogListResponse>('/core/operation-logs', {
    params,
  });
}

/**
 * 获取操作日志统计
 */
export async function getOperationLogStats(params?: {
  start_time?: string;
  end_time?: string;
}): Promise<OperationLogStats> {
  return apiRequest<OperationLogStats>('/core/operation-logs/stats', {
    params,
  });
}

