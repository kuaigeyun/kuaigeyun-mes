/**
 * 定时任务管理服务
 * 
 * 提供定时任务的 CRUD 操作和启动/停止功能。
 * 注意：所有 API 自动过滤当前组织的定时任务
 */

import { apiRequest } from './api';

export interface ScheduledTask {
  uuid: string;
  tenant_id: number;
  name: string;
  code: string;
  description?: string;
  type: 'python_script' | 'api_call';
  trigger_type: 'cron' | 'interval' | 'date';
  trigger_config: Record<string, any>;
  task_config: Record<string, any>;
  inngest_function_id?: string;
  is_active: boolean;
  is_running: boolean;
  last_run_at?: string;
  last_run_status?: 'success' | 'failed';
  last_error?: string;
  created_at: string;
  updated_at: string;
}

export interface ScheduledTaskListParams {
  skip?: number;
  limit?: number;
  type?: string;
  trigger_type?: string;
  is_active?: boolean;
}

export interface CreateScheduledTaskData {
  name: string;
  code: string;
  description?: string;
  type: 'python_script' | 'api_call';
  trigger_type: 'cron' | 'interval' | 'date';
  trigger_config: Record<string, any>;
  task_config: Record<string, any>;
  is_active?: boolean;
}

export interface UpdateScheduledTaskData {
  name?: string;
  description?: string;
  trigger_type?: 'cron' | 'interval' | 'date';
  trigger_config?: Record<string, any>;
  task_config?: Record<string, any>;
  is_active?: boolean;
}

/**
 * 获取定时任务列表
 */
export async function getScheduledTaskList(params?: ScheduledTaskListParams): Promise<ScheduledTask[]> {
  return apiRequest<ScheduledTask[]>('/core/scheduled-tasks', {
    params,
  });
}

/**
 * 获取定时任务详情
 */
export async function getScheduledTaskByUuid(scheduledTaskUuid: string): Promise<ScheduledTask> {
  return apiRequest<ScheduledTask>(`/core/scheduled-tasks/${scheduledTaskUuid}`);
}

/**
 * 创建定时任务
 */
export async function createScheduledTask(data: CreateScheduledTaskData): Promise<ScheduledTask> {
  return apiRequest<ScheduledTask>('/core/scheduled-tasks', {
    method: 'POST',
    data,
  });
}

/**
 * 更新定时任务
 */
export async function updateScheduledTask(scheduledTaskUuid: string, data: UpdateScheduledTaskData): Promise<ScheduledTask> {
  return apiRequest<ScheduledTask>(`/core/scheduled-tasks/${scheduledTaskUuid}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除定时任务
 */
export async function deleteScheduledTask(scheduledTaskUuid: string): Promise<void> {
  return apiRequest<void>(`/core/scheduled-tasks/${scheduledTaskUuid}`, {
    method: 'DELETE',
  });
}

/**
 * 启动定时任务
 */
export async function startScheduledTask(scheduledTaskUuid: string): Promise<ScheduledTask> {
  return apiRequest<ScheduledTask>(`/core/scheduled-tasks/${scheduledTaskUuid}/start`, {
    method: 'POST',
  });
}

/**
 * 停止定时任务
 */
export async function stopScheduledTask(scheduledTaskUuid: string): Promise<ScheduledTask> {
  return apiRequest<ScheduledTask>(`/core/scheduled-tasks/${scheduledTaskUuid}/stop`, {
    method: 'POST',
  });
}

