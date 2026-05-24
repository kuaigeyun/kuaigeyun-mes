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
  /** work_order | exception | quality_inspection | warehouse | outbound | purchase | sales | equipment */
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
    completed_quantity: number;
    capacity_achievement_rate: number;
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
export async function getTodos(limit: number = 20, module?: string): Promise<TodoListResponse> {
  return apiRequest<TodoListResponse>('/apps/kuaizhizao/dashboard/todos', {
    params: { limit, ...(module ? { module } : {}) },
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
 * @param dateStart 开始日期（YYYY-MM-DD），可选
 * @param dateEnd 结束日期（YYYY-MM-DD），可选
 */
export async function getStatistics(
  dateStart?: string,
  dateEnd?: string
): Promise<StatisticsResponse> {
  return apiRequest<StatisticsResponse>('/apps/kuaizhizao/dashboard/statistics', {
    params: {
      ...(dateStart && { date_start: dateStart }),
      ...(dateEnd && { date_end: dateEnd }),
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
 * 左侧菜单业务单据未完成数量（用于报表/大屏/业务单据小徽标）
 * key 与菜单 path 映射见 BasicLayout 中的 MENU_BADGE_PATH_KEY
 *
 * 与销售订单一致的三态：逾期(红) > 待审核(橙) > 进行中(绿)；亦可为单一数字。
 */
export interface MenuBadgeTriState {
  overdue: number;
  pending: number;
  in_progress: number;
}

export type MenuBadgeEntry = number | MenuBadgeTriState;

export type MenuBadgeCounts = Record<string, MenuBadgeEntry>;

export async function getMenuBadgeCounts(): Promise<MenuBadgeCounts> {
  try {
    return await apiRequest<MenuBadgeCounts>('/apps/kuaizhizao/dashboard/menu-badge-counts');
  } catch {
    return {};
  }
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
  current_progress: number;
  task_count: number;
  planned_quantity: number;
  completed_quantity: number;
  qualified_quantity: number;
  unqualified_quantity: number;
  status: string;
}

/**
 * 工序执行进展响应
 */
export interface ProcessProgressResponse {
  items: ProcessProgressItem[];
}

/**
 * 获取工序执行进展
 */
export async function getProcessProgress(includeUnstarted: boolean = false): Promise<ProcessProgressItem[]> {
  const response = await apiRequest<ProcessProgressResponse>('/apps/kuaizhizao/dashboard/process-progress', {
    params: { include_unstarted: includeUnstarted },
  });
  return response.items;
}

/**
 * 生产实时播报项
 */
export interface ProductionBroadcastItem {
  id: string;
  operator_name: string;
  /** 操作员头像文件 UUID，无则前端用姓名首字 */
  operator_avatar?: string | null;
  process_name: string;
  date: string;
  work_order_no: string;
  product_code: string;
  product_name: string;
  qualified_quantity: number;
  unqualified_quantity: number;
  created_at: string;
}

/**
 * 生产实时播报响应
 */
export interface ProductionBroadcastResponse {
  items: ProductionBroadcastItem[];
}

/**
 * 获取生产实时播报
 */
export async function getProductionBroadcast(limit: number = 10): Promise<ProductionBroadcastItem[]> {
  const response = await apiRequest<ProductionBroadcastResponse>('/apps/kuaizhizao/dashboard/production-broadcast', {
    params: { limit },
  });
  return response.items;
}

/**
 * 销售中心汇总
 */
export interface SalesSummary {
  pending_quotations: number;
  new_quotations_this_month: number;
  pending_shipments: number;
  overdue_shipments: number;
  achievement_rate: number;
  total_amount: number;
  total_amount_last_month: number;
}

export async function getSalesSummary(
  dateStart?: string,
  dateEnd?: string,
): Promise<SalesSummary> {
  return apiRequest<SalesSummary>('/apps/kuaizhizao/dashboard/sales-summary', {
    params: {
      ...(dateStart && { date_start: dateStart }),
      ...(dateEnd && { date_end: dateEnd }),
    },
  });
}

/**
 * 采购中心汇总
 */
export interface PurchaseSummary {
  pending_requisitions: number;
  urgent_requisitions: number;
  new_requisitions_this_month: number;
  pending_receipts: number;
  overdue_receipts: number;
  arrival_rate: number;
}

export async function getPurchaseSummary(
  dateStart?: string,
  dateEnd?: string,
): Promise<PurchaseSummary> {
  return apiRequest<PurchaseSummary>('/apps/kuaizhizao/dashboard/purchase-summary', {
    params: {
      ...(dateStart && { date_start: dateStart }),
      ...(dateEnd && { date_end: dateEnd }),
    },
  });
}

/**
 * 制造中心汇总（today_output：所选日期范围内成品入库已入库数量合计）
 */
export interface ManufacturingSummary {
  pending_scheduling: number;
  in_progress_count: number;
  rework_count: number;
  /** 区间内成品入库单（已入库）数量合计；字段名历史兼容 */
  today_output: number;
  qualified_rate: number;
  pending_reporting: number;
}

export async function getManufacturingSummary(
  dateStart?: string,
  dateEnd?: string,
): Promise<ManufacturingSummary> {
  return apiRequest<ManufacturingSummary>('/apps/kuaizhizao/dashboard/manufacturing-summary', {
    params: {
      ...(dateStart && { date_start: dateStart }),
      ...(dateEnd && { date_end: dateEnd }),
    },
  });
}

/**
 * 设备看板汇总
 */
export interface EquipmentSummary {
  repairing_count: number;
  today_maintenance_tasks: number;
  oee: number;
}

export async function getEquipmentSummary(
  dateStart?: string,
  dateEnd?: string,
): Promise<EquipmentSummary> {
  return apiRequest<EquipmentSummary>('/apps/kuaizhizao/dashboard/equipment-summary', {
    params: {
      ...(dateStart && { date_start: dateStart }),
      ...(dateEnd && { date_end: dateEnd }),
    },
  });
}

/**
 * 管理指标
 */
export interface ManagementMetrics {
  average_production_cycle: number;
  on_time_delivery_rate: number;
}

export async function getManagementMetrics(
  dateStart?: string,
  dateEnd?: string,
): Promise<ManagementMetrics> {
  return apiRequest<ManagementMetrics>('/apps/kuaizhizao/dashboard/management-metrics', {
    params: {
      ...(dateStart && { date_start: dateStart }),
      ...(dateEnd && { date_end: dateEnd }),
    },
  });
}

/**
 * 物料 TOP 排行项（销售 / 采购共用）
 */
export interface MaterialRankingItem {
  material_id: number;
  material_code: string;
  material_name: string;
  quantity: number;
  amount: number;
}

interface MaterialRankingResponse {
  items: MaterialRankingItem[];
}

/**
 * 销售产品排行 TOP10
 */
export async function getSalesTop10(
  dateStart?: string,
  dateEnd?: string,
  limit: number = 10,
): Promise<MaterialRankingItem[]> {
  const response = await apiRequest<MaterialRankingResponse>(
    '/apps/kuaizhizao/dashboard/sales-top10',
    {
      params: {
        limit,
        ...(dateStart && { date_start: dateStart }),
        ...(dateEnd && { date_end: dateEnd }),
      },
    },
  );
  return response.items;
}

/**
 * 原料采购排行 TOP10
 */
export async function getPurchaseTop10(
  dateStart?: string,
  dateEnd?: string,
  limit: number = 10,
): Promise<MaterialRankingItem[]> {
  const response = await apiRequest<MaterialRankingResponse>(
    '/apps/kuaizhizao/dashboard/purchase-top10',
    {
      params: {
        limit,
        ...(dateStart && { date_start: dateStart }),
        ...(dateEnd && { date_end: dateEnd }),
      },
    },
  );
  return response.items;
}

/**
 * 执行中工单工序
 */
export interface ActiveWorkOrderStep {
  name: string;
  sequence: number;
  /** done | active | pending */
  status: 'done' | 'active' | 'pending';
  /** 仅 active 有意义，0-100 */
  progress: number;
}

/**
 * 执行中工单
 */
export interface ActiveWorkOrderItem {
  /** 工单主键（用于拉取工序明细） */
  work_order_id: number;
  /** 工单编码（展示用） */
  id: string;
  product_code: string;
  product: string;
  planned: number;
  qualified: number;
  completed: number;
  steps: ActiveWorkOrderStep[];
}

interface ActiveWorkOrdersResponse {
  items: ActiveWorkOrderItem[];
}

/**
 * 获取执行中工单列表（含工序步骤）
 */
export async function getActiveWorkOrders(limit: number = 50): Promise<ActiveWorkOrderItem[]> {
  const response = await apiRequest<ActiveWorkOrdersResponse>(
    '/apps/kuaizhizao/dashboard/work-orders-active',
    { params: { limit } },
  );
  return response.items;
}

/**
 * 仓储中心汇总指标
 */
export interface WarehouseSummary {
  total_stock: number;
  in_stock_batches: number;
  pending_inbound: number;
  pending_outbound: number;
}

export async function getWarehouseSummary(): Promise<WarehouseSummary> {
  return apiRequest<WarehouseSummary>('/apps/kuaizhizao/dashboard/warehouse-summary');
}

/**
 * 仓储入/出库按日走势项
 */
export interface WarehouseTrendPoint {
  /** MM-DD */
  date: string;
  in: number;
  out: number;
}

interface WarehouseTrendResponse {
  items: WarehouseTrendPoint[];
}

/**
 * 获取仓储入/出库按日走势
 */
export async function getWarehouseTrend(
  dateStart?: string,
  dateEnd?: string,
): Promise<WarehouseTrendPoint[]> {
  const response = await apiRequest<WarehouseTrendResponse>(
    '/apps/kuaizhizao/dashboard/warehouse-trend',
    {
      params: {
        ...(dateStart && { date_start: dateStart }),
        ...(dateEnd && { date_end: dateEnd }),
      },
    },
  );
  return response.items;
}
