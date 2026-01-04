/**
 * 工作台Dashboard服务
 *
 * 提供工作台相关的API调用
 *
 * @author Luigi Lu
 * @date 2025-01-15
 */

import { apiRequest } from './api';

/**
 * 待办事项项
 */
export interface TodoItem {
  id: string;
  type: string;
  title: string;
  description?: string;
  priority: string;
  due_date?: string;
  status: string;
  link?: string;
  created_at: string;
}

/**
 * 待办事项列表响应
 */
export interface TodoListResponse {
  items: TodoItem[];
  total: number;
}

/**
 * 统计数据响应
 */
export interface StatisticsResponse {
  production: {
    total: number;
    completed: number;
    in_progress: number;
    completion_rate: number;
  };
  inventory: {
    total_quantity: number;
    total_value: number;
    turnover_rate: number;
    alert_count: number;
  };
  quality: {
    total_exceptions: number;
    open_exceptions: number;
    quality_rate: number;
  };
}

/**
 * 工作台数据响应
 */
export interface DashboardResponse {
  todos: TodoListResponse;
  statistics: StatisticsResponse;
}

/**
 * 获取待办事项列表
 */
export async function getTodos(limit: number = 20): Promise<TodoListResponse> {
  return apiRequest<TodoListResponse>('/apps/kuaizhizao/dashboard/todos', {
    params: { limit },
  });
}

/**
 * 处理待办事项
 */
export async function handleTodo(todoId: string, action: string): Promise<void> {
  return apiRequest(`/apps/kuaizhizao/dashboard/todos/${todoId}/handle`, {
    method: 'POST',
    params: { action },
  });
}

/**
 * 获取统计数据
 */
export async function getStatistics(): Promise<StatisticsResponse> {
  return apiRequest<StatisticsResponse>('/apps/kuaizhizao/dashboard/statistics');
}

/**
 * 获取工作台数据
 */
export async function getDashboard(): Promise<DashboardResponse> {
  return apiRequest<DashboardResponse>('/apps/kuaizhizao/dashboard');
}

