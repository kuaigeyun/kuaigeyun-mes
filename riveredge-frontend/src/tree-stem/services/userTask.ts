/**
 * 用户任务管理服务
 * 
 * 提供用户任务的查询、处理等功能。
 * 注意：所有 API 自动获取当前用户的任务。
 */

import { apiRequest } from './api';

export interface UserTask {
  uuid: string;
  tenant_id: number;
  process_uuid?: string;
  title: string;
  content?: string;
  data?: Record<string, any>;
  submitter_id: number;
  current_approver_id?: number;
  status: string;
  current_node?: string;
  submitted_at: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface UserTaskListResponse {
  items: UserTask[];
  total: number;
  page: number;
  page_size: number;
}

export interface UserTaskStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  submitted: number;
}

export interface TaskActionRequest {
  action: 'approve' | 'reject';
  comment?: string;
}

/**
 * 获取当前用户任务列表
 */
export async function getUserTasks(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  task_type?: 'pending' | 'submitted';
}): Promise<UserTaskListResponse> {
  return apiRequest<UserTaskListResponse>('/personal/user-tasks', {
    params,
  });
}

/**
 * 获取当前用户任务详情
 */
export async function getUserTask(taskUuid: string): Promise<UserTask> {
  return apiRequest<UserTask>(`/personal/user-tasks/${taskUuid}`);
}

/**
 * 获取当前用户任务统计
 */
export async function getUserTaskStats(): Promise<UserTaskStats> {
  return apiRequest<UserTaskStats>('/personal/user-tasks/stats');
}

/**
 * 处理用户任务（审批或拒绝）
 */
export async function processUserTask(
  taskUuid: string,
  data: TaskActionRequest
): Promise<UserTask> {
  return apiRequest<UserTask>(`/personal/user-tasks/${taskUuid}/process`, {
    method: 'POST',
    data,
  });
}

