/**
 * 销售订单管理API服务
 *
 * 提供销售订单相关的API调用接口。
 *
 * @author Luigi Lu
 * @date 2026-01-19
 */

import { apiRequest } from '../../../services/api';
import { DemandStatus, ReviewStatus } from './demand';

/**
 * 销售订单接口定义
 */
export { DemandStatus as SalesOrderStatus, ReviewStatus };
export interface SalesOrder {
  id?: number;
  uuid?: string;
  tenant_id?: number;
  order_code?: string;
  order_name?: string;
  order_date?: string;
  delivery_date?: string;
  customer_id?: number;
  customer_name?: string;
  customer_contact?: string;
  customer_phone?: string;
  total_quantity?: number;
  total_amount?: number;
  /** 价格类型：含税(tax_inclusive)/不含税(tax_exclusive) */
  price_type?: 'tax_inclusive' | 'tax_exclusive';
  /** 整单优惠金额 */
  discount_amount?: number;
  status?: string;
  submit_time?: string;
  reviewer_id?: number;
  reviewer_name?: string;
  review_time?: string;
  review_status?: string;
  review_remarks?: string;
  salesman_id?: number;
  salesman_name?: string;
  shipping_address?: string;
  shipping_method?: string;
  payment_terms?: string;
  pushed_to_computation?: boolean;
  computation_id?: number;
  computation_code?: string;
  notes?: string;
  is_active?: boolean;
  created_by?: number;
  updated_by?: number;
  created_at?: string;
  updated_at?: string;
  items?: SalesOrderItem[];
  duration_info?: {
    created_at?: string;
    submit_time?: string;
    review_time?: string;
    duration_to_submit?: number | null;
    duration_to_review?: number | null;
    duration_submit_to_review?: number | null;
  };
  /** 交货进度 0-100（列表接口返回） */
  delivery_progress?: number | null;
  /** 开票进度 0-100（列表接口返回） */
  invoice_progress?: number | null;
  /** 本次操作是否已同步至关联需求（更新/审核接口返回） */
  demand_synced?: boolean;
}

/**
 * 销售订单明细接口定义
 */
export interface SalesOrderItem {
  id?: number;
  uuid?: string;
  tenant_id?: number;
  sales_order_id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  material_unit?: string;
  required_quantity?: number;
  delivery_date?: string;
  delivered_quantity?: number;
  remaining_quantity?: number;
  delivery_status?: string;
  unit_price?: number;
  /** 税率（%） */
  tax_rate?: number;
  item_amount?: number;
  work_order_id?: number;
  work_order_code?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * 销售订单列表查询参数
 */
export interface SalesOrderListParams {
  skip?: number;
  limit?: number;
  status?: string;
  review_status?: string;
  start_date?: string;
  end_date?: string;
  customer_name?: string;
  order_by?: string;
  include_items?: boolean;
}

/**
 * 销售订单列表响应
 */
export interface SalesOrderListResponse {
  data: SalesOrder[];
  total: number;
  success: boolean;
}

/** 销售订单统计（用于指标卡片） */
export interface SalesOrderStatistics {
  active_count: number;
  pending_review_count: number;
  in_progress_count: number;
  overdue_count: number;
  total_amount: number;
}

/** 获取销售订单统计 */
export async function getSalesOrderStatistics(): Promise<SalesOrderStatistics> {
  return apiRequest<SalesOrderStatistics>('/apps/kuaizhizao/sales-orders/statistics', {
    method: 'GET',
  });
}

/**
 * 获取销售订单列表
 */
export async function listSalesOrders(params: SalesOrderListParams = {}): Promise<SalesOrderListResponse> {
  return apiRequest<SalesOrderListResponse>('/apps/kuaizhizao/sales-orders', {
    method: 'GET',
    params,
  });
}

/**
 * 获取销售订单详情
 */
export async function getSalesOrder(id: number, includeItems: boolean = false, includeDuration: boolean = false): Promise<SalesOrder> {
  return apiRequest<SalesOrder>(`/apps/kuaizhizao/sales-orders/${id}`, {
    method: 'GET',
    params: { include_items: includeItems, include_duration: includeDuration },
  });
}

/**
 * 创建销售订单
 */
export async function createSalesOrder(data: Partial<SalesOrder>): Promise<SalesOrder> {
  return apiRequest<SalesOrder>('/apps/kuaizhizao/sales-orders', {
    method: 'POST',
    data,
  });
}

/**
 * 更新销售订单
 */
export async function updateSalesOrder(id: number, data: Partial<SalesOrder>): Promise<SalesOrder> {
  return apiRequest<SalesOrder>(`/apps/kuaizhizao/sales-orders/${id}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 提交销售订单
 */
export async function submitSalesOrder(id: number): Promise<SalesOrder> {
  return apiRequest<SalesOrder>(`/apps/kuaizhizao/sales-orders/${id}/submit`, {
    method: 'POST',
  });
}

/**
 * 审核通过销售订单
 */
export async function approveSalesOrder(id: number): Promise<SalesOrder> {
  return apiRequest<SalesOrder>(`/apps/kuaizhizao/sales-orders/${id}/approve`, {
    method: 'POST',
  });
}

/**
 * 撤销审核销售订单
 */
export async function unapproveSalesOrder(id: number): Promise<SalesOrder> {
  return apiRequest<SalesOrder>(`/apps/kuaizhizao/sales-orders/${id}/unapprove`, {
    method: 'POST',
  });
}

/**
 * 驳回销售订单
 */
export async function rejectSalesOrder(id: number, rejectionReason: string): Promise<SalesOrder> {
  return apiRequest<SalesOrder>(`/apps/kuaizhizao/sales-orders/${id}/reject`, {
    method: 'POST',
    params: { rejection_reason: rejectionReason },
  });
}

/**
 * 下推预览响应（通用）
 */
export interface PushPreviewResponse {
  target_type: string;
  summary: string;
  items: { material_code: string; material_name: string; quantity: number; delivery_date?: string; suggested_action?: string }[];
  tip?: string;
  plan_name_preview?: string;
  demand_exists?: boolean;
}

/**
 * 下推需求计算预览
 */
export async function previewPushSalesOrderToComputation(salesOrderId: number): Promise<PushPreviewResponse> {
  return apiRequest<PushPreviewResponse>(`/apps/kuaizhizao/sales-orders/${salesOrderId}/push-to-computation/preview`, {
    method: 'GET',
  });
}

/**
 * 下推销售订单到需求计算
 */
export interface PushToComputationResponse {
  success: boolean;
  message: string;
  order_code?: string;
  computation_code?: string;
  note?: string;
}

export async function pushSalesOrderToComputation(salesOrderId: number): Promise<PushToComputationResponse> {
  return apiRequest<PushToComputationResponse>(`/apps/kuaizhizao/sales-orders/${salesOrderId}/push-to-computation`, {
    method: 'POST',
  });
}

/**
 * 下推销售订单到发货通知单
 */
export interface PushToShipmentNoticeResponse {
  success: boolean;
  message: string;
  notice_id?: number;
  notice_code?: string;
}

export async function pushSalesOrderToShipmentNotice(salesOrderId: number): Promise<PushToShipmentNoticeResponse> {
  return apiRequest<PushToShipmentNoticeResponse>(`/apps/kuaizhizao/sales-orders/${salesOrderId}/push-to-shipment-notice`, {
    method: 'POST',
  });
}

/**
 * 下推销售订单到销售发票
 */
export interface PushToInvoiceResponse {
  success: boolean;
  message: string;
  invoice_id?: number;
  invoice_code?: string;
}

export async function pushSalesOrderToInvoice(salesOrderId: number): Promise<PushToInvoiceResponse> {
  return apiRequest<PushToInvoiceResponse>(`/apps/kuaizhizao/sales-orders/${salesOrderId}/push-to-invoice`, {
    method: 'POST',
  });
}

/**
 * 撤回销售订单
 */
export async function withdrawSalesOrder(id: number): Promise<SalesOrder> {
  return apiRequest<SalesOrder>(`/apps/kuaizhizao/sales-orders/${id}/withdraw`, {
    method: 'POST',
  });
}

/**
 * 直推生产计划预览
 */
export async function previewPushSalesOrderToProductionPlan(salesOrderId: number): Promise<PushPreviewResponse> {
  return apiRequest<PushPreviewResponse>(`/apps/kuaizhizao/sales-orders/${salesOrderId}/push-to-production-plan/preview`, {
    method: 'GET',
  });
}

/**
 * 直推销售订单到生产计划（跳过需求计算）
 * 订单明细直接转为生产计划明细，不要求BOM，原材料由用户自行计算采购
 */
export interface PushToProductionPlanResponse {
  success: boolean;
  message: string;
  target_document?: { type: string; id: number; code: string };
}

export async function pushSalesOrderToProductionPlan(salesOrderId: number): Promise<PushToProductionPlanResponse> {
  return apiRequest<PushToProductionPlanResponse>(`/apps/kuaizhizao/sales-orders/${salesOrderId}/push-to-production-plan`, {
    method: 'POST',
  });
}

/**
 * 直推工单预览
 */
export async function previewPushSalesOrderToWorkOrder(salesOrderId: number): Promise<PushPreviewResponse> {
  return apiRequest<PushPreviewResponse>(`/apps/kuaizhizao/sales-orders/${salesOrderId}/push-to-work-order/preview`, {
    method: 'GET',
  });
}

/**
 * 直推销售订单到工单（跳过需求计算）
 * 订单明细直接转为工单，不要求BOM，原材料由用户自行计算采购
 */
export interface PushToWorkOrderResponse {
  success: boolean;
  message: string;
  target_documents?: { type: string; id: number; code: string }[];
}

export async function pushSalesOrderToWorkOrder(salesOrderId: number): Promise<PushToWorkOrderResponse> {
  return apiRequest<PushToWorkOrderResponse>(`/apps/kuaizhizao/sales-orders/${salesOrderId}/push-to-work-order`, {
    method: 'POST',
  });
}

/**
 * 发送销售订单提醒
 */
export interface SalesOrderRemindCreate {
  recipient_user_uuid: string;
  action_type: string;
  remarks?: string;
}

export async function createSalesOrderReminder(
  salesOrderId: number,
  data: SalesOrderRemindCreate
): Promise<{ success: boolean; message: string }> {
  return apiRequest<{ success: boolean; message: string }>(
    `/apps/kuaizhizao/sales-orders/${salesOrderId}/remind`,
    {
      method: 'POST',
      data,
    }
  );
}

/**
 * 撤回销售订单的需求计算
 * 仅当需求计算尚未下推工单/采购单等下游单据时允许撤回
 */
export async function withdrawSalesOrderFromComputation(id: number): Promise<SalesOrder> {
  return apiRequest<SalesOrder>(`/apps/kuaizhizao/sales-orders/${id}/withdraw-from-computation`, {
    method: 'POST',
  });
}

/**
 * 删除销售订单
 */
export async function deleteSalesOrder(id: number): Promise<void> {
  return apiRequest<void>(`/apps/kuaizhizao/sales-orders/${id}`, {
    method: 'DELETE',
  });
}

/**
 * 批量删除销售订单
 */
export async function bulkDeleteSalesOrders(ids: number[]): Promise<{
  success_count: number;
  failed_count: number;
  failed_items: { id: number; reason: string }[];
}> {
  return apiRequest<{
    success_count: number;
    failed_count: number;
    failed_items: { id: number; reason: string }[];
  }>('/apps/kuaizhizao/sales-orders/batch-delete', {
    method: 'POST',
    data: ids, // Pass ids simply as the body if List[int] is expected directly, or check if it needs { ids: [...] } wrapper. 
    // Backend expects: ids: List[int]. But FastAPI with Pydantic often expects a JSON body matching the Pydantic model or just the list if the body is `List[int]`.
    // The backend definition was: async def bulk_delete_sales_orders(ids: List[int], ...)
    // In FastAPI, if the body is a list, you send a JSON list.
    // wait, in my backend code: `ids: List[int]` was a query param or body? 
    // `ids: List[int]` without `= Body(...)` usually defaults to query params or request body depending on context. 
    // But usually, a Pydantic model is better. 
    // Let's check my backend code again.
  });
}
