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
    order_count?: number;
    product_count?: number;
    plan_quantity?: number;
    completed_quantity?: number;
    defect_rate?: number;
    capacity_achievement_rate?: number;
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
export async function getStatistics(
  dateStart?: string,
  dateEnd?: string
): Promise<StatisticsResponse> {
  return apiRequest<StatisticsResponse>('/apps/kuaizhizao/dashboard/statistics', {
    method: 'GET',
    params: {
      date_start: dateStart,
      date_end: dateEnd,
    },
  });
}

/**
 * 获取工作台数据
 */
export async function getDashboard(): Promise<DashboardResponse> {
  return apiRequest<DashboardResponse>('/apps/kuaizhizao/dashboard');
}


/**
 * 通知项接口
 */
export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  content: string;
  time: string;
  read: boolean;
}

/**
 * 用户消息响应
 */
export interface UserMessageResponse {
  uuid: string;
  type: string;
  subject?: string;
  content: string;
  status: string;
  created_at: string;
}

/**
 * 用户消息列表响应
 */
export interface UserMessageListResponse {
  items: UserMessageResponse[];
  total: number;
  page: number;
  page_size: number;
}

/**
 * 获取用户消息列表（用于工作台通知）
 */
export async function getUserMessages(
  page: number = 1,
  pageSize: number = 20,
  unreadOnly: boolean = false
): Promise<NotificationItem[]> {
  const response = await apiRequest<UserMessageListResponse>('/personal/user-messages', {
    method: 'GET',
    params: {
      page,
      page_size: pageSize,
      unread_only: unreadOnly,
    },
  });

  // 转换为工作台需要的通知格式
  return response.items.map((msg) => ({
    id: msg.uuid,
    type: msg.type || 'system', // 消息类型：email、sms、internal、push等
    title: msg.subject || '系统通知', // 使用subject作为标题，如果没有则使用默认值
    content: msg.content,
    time: msg.created_at,
    read: msg.status === 'read', // read状态表示已读，其他状态表示未读
  }));
}

/**
 * 标记消息为已读
 */
export async function markMessagesRead(messageUuids: string[]): Promise<{ updated_count: number }> {
  return apiRequest<{ updated_count: number }>('/personal/user-messages/mark-read', {
    method: 'POST',
    data: {
      message_uuids: messageUuids,
    },
  });
}

/**
 * 工序执行进展项
 */
export interface ProcessProgressItem {
  process_id: string;
  process_name: string;
  current_progress: number;     // 当前进度（百分比）
  task_count: number;           // 生产任务数
  planned_quantity: number;     // 计划数
  qualified_quantity: number;   // 合格数
  unqualified_quantity: number; // 不合格数
  status: 'not_started' | 'in_progress' | 'completed';
}

/**
 * 工序执行进展响应
 */
export interface ProcessProgressResponse {
  items: ProcessProgressItem[];
}

/**
 * 获取工序执行进展
 * @param includeUnstarted 是否包含未开始生产任务
 */
export async function getProcessProgress(
  includeUnstarted: boolean = false
): Promise<ProcessProgressItem[]> {
  const response = await apiRequest<ProcessProgressResponse>('/apps/kuaizhizao/dashboard/process-progress', {
    method: 'GET',
    params: {
      include_unstarted: includeUnstarted,
    },
  });
  return response.items;
}

/**
 * 管理指标响应
 */
export interface ManagementMetricsResponse {
  average_production_cycle: number;  // 平均订单生产周期（天）
  on_time_delivery_rate: number;     // 准交率（%）
}

/**
 * 获取管理指标
 * @param dateStart 开始日期（YYYY-MM-DD）
 * @param dateEnd 结束日期（YYYY-MM-DD）
 */
export async function getManagementMetrics(
  dateStart?: string,
  dateEnd?: string
): Promise<ManagementMetricsResponse> {
  return apiRequest<ManagementMetricsResponse>('/apps/kuaizhizao/dashboard/management-metrics', {
    method: 'GET',
    params: {
      date_start: dateStart,
      date_end: dateEnd,
    },
  });
}

/**
 * 生产实时播报项
 */
export interface ProductionBroadcastItem {
  id: string;
  operator_name: string;        // 操作员姓名
  process_name: string;         // 工序名称
  date: string;                 // 日期
  work_order_no: string;        // 工单号
  product_code: string;         // 产品编码
  product_name: string;         // 产品名称
  qualified_quantity: number;   // 合格数
  unqualified_quantity: number; // 不合格数
  created_at: string;           // 创建时间
}

/**
 * 生产实时播报响应
 */
export interface ProductionBroadcastResponse {
  items: ProductionBroadcastItem[];
}

/**
 * 获取生产实时播报
 * @param limit 返回数量限制（默认10条，最多50条）
 */
export async function getProductionBroadcast(
  limit: number = 10
): Promise<ProductionBroadcastItem[]> {
  const response = await apiRequest<ProductionBroadcastResponse>('/apps/kuaizhizao/dashboard/production-broadcast', {
    method: 'GET',
    params: {
      limit,
    },
  });
  return response.items;
}
