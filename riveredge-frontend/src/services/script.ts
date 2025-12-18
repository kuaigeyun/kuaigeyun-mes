/**
 * 脚本管理服务
 * 
 * 提供脚本的 CRUD 操作和脚本执行功能。
 * 注意：所有 API 自动过滤当前组织的脚本
 */

import { apiRequest } from './api';

export interface Script {
  uuid: string;
  tenant_id: number;
  name: string;
  code: string;
  type: string;
  description?: string;
  content: string;
  config?: Record<string, any>;
  is_active: boolean;
  is_running: boolean;
  inngest_function_id?: string;
  last_run_at?: string;
  last_run_status?: 'success' | 'failed' | 'running';
  last_error?: string;
  created_at: string;
  updated_at: string;
}

export interface ScriptListParams {
  skip?: number;
  limit?: number;
  type?: string;
  is_active?: boolean;
}

export interface CreateScriptData {
  name: string;
  code: string;
  type: string;
  description?: string;
  content: string;
  config?: Record<string, any>;
}

export interface UpdateScriptData {
  name?: string;
  description?: string;
  content?: string;
  config?: Record<string, any>;
  is_active?: boolean;
}

export interface ExecuteScriptData {
  parameters?: Record<string, any>;
  async_execution?: boolean;
}

export interface ScriptExecuteResponse {
  success: boolean;
  output?: string;
  error?: string;
  execution_time?: number;
  inngest_run_id?: string;
}

/**
 * 获取脚本列表
 */
export async function getScriptList(params?: ScriptListParams): Promise<Script[]> {
  return apiRequest<Script[]>('/core/scripts', {
    params,
  });
}

/**
 * 获取脚本详情
 */
export async function getScriptByUuid(scriptUuid: string): Promise<Script> {
  return apiRequest<Script>(`/core/scripts/${scriptUuid}`);
}

/**
 * 创建脚本
 */
export async function createScript(data: CreateScriptData): Promise<Script> {
  return apiRequest<Script>('/core/scripts', {
    method: 'POST',
    data,
  });
}

/**
 * 更新脚本
 */
export async function updateScript(scriptUuid: string, data: UpdateScriptData): Promise<Script> {
  return apiRequest<Script>(`/core/scripts/${scriptUuid}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除脚本
 */
export async function deleteScript(scriptUuid: string): Promise<void> {
  return apiRequest<void>(`/core/scripts/${scriptUuid}`, {
    method: 'DELETE',
  });
}

/**
 * 执行脚本
 */
export async function executeScript(scriptUuid: string, data: ExecuteScriptData): Promise<ScriptExecuteResponse> {
  return apiRequest<ScriptExecuteResponse>(`/core/scripts/${scriptUuid}/execute`, {
    method: 'POST',
    data,
  });
}

