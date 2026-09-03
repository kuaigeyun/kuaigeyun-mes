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

export interface SalesOrderPaymentMilestone {
  id?: number;
  milestone_name: string;
  planned_date: string;
  planned_amount?: number;
  planned_ratio?: number;
  billing_trigger?: string;
  /** 预收节点：审单自动生成预收收款单 */
  is_prepayment?: boolean;
  bank_account_id?: number | null;
  status?: string;
  receivable_id?: number;
  receivable_code?: string;
  notes?: string;
}

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
  /** 币种代码（默认 CNY） */
  currency_code?: string;
  pushed_to_computation?: boolean;
  computation_id?: number;
  computation_code?: string;
  notes?: string;
  is_active?: boolean;
  created_by?: number;
  created_by_name?: string;
  updated_by?: number;
  updated_by_name?: string;
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
  /** 关联框架合同 */
  contract_id?: number;
  contract_code?: string;
  is_release_order?: boolean;
  term_group_id?: number;
  term_group_name?: string;
  contract_terms?: import('./sales-contract-term').SalesContractTermSnapshot[];
  payment_milestones?: SalesOrderPaymentMilestone[];
  /** 交货进度 0-100（列表接口返回） */
  delivery_progress?: number | null;
  /** 开票进度 0-100（列表接口返回） */
  invoice_progress?: number | null;
  /** 已下推工单数量（列表接口返回） */
  pushed_work_order_quantity?: number;
  pushed_work_order_codes?: string[];
  /** 剩余可下推数量（列表接口返回） */
  remaining_push_quantity?: number;
  /** 工单下推占比 0-100（列表接口返回） */
  work_order_push_progress?: number;
  /** 是否存在可发货产品（库存满足且仍有欠交） */
  has_shippable_products?: boolean;
  /** 当前可发货数量合计 */
  shippable_quantity?: number;
  /** 本次操作是否已同步至关联需求（更新/审核接口返回） */
  demand_synced?: boolean;
  fee_details?: any[];
  total_fee_amount?: number;
  /** 单据头附件（上传字段 attachments） */
  attachments?: import('../utils/documentAttachments').DocumentAttachmentFile[];
  lifecycle?: Record<string, unknown>;
  audit?: Record<string, unknown>;
  capabilities?: SalesOrderCapabilities;
}

export interface ActionCapability {
  allowed: boolean;
  reason?: string | null;
}

export interface SalesOrderCapabilities {
  update?: ActionCapability;
  delete?: ActionCapability;
  submit?: ActionCapability;
  approve?: ActionCapability;
  close?: ActionCapability;
  reopen?: ActionCapability;
  print?: ActionCapability;
  withdraw_submit?: ActionCapability;
  revoke_approval?: ActionCapability;
  push_computation?: ActionCapability;
  withdraw_computation?: ActionCapability;
  push_work_order?: ActionCapability;
  push_shipment_notice?: ActionCapability;
  push_sales_delivery?: ActionCapability;
  push_invoice?: ActionCapability;
  push_sales_return?: ActionCapability;
  push_delivery_project?: ActionCapability;
  create_change_order?: ActionCapability;
  backfill_sales_contract?: ActionCapability;
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
  /** 单位换算因子（业务单位 -> 基础单位） */
  conversion_factor?: number;
  /** 响应字段：与 order_quantity 同源（后端 schema 名 required_quantity） */
  required_quantity?: number;
  /** 订单数量（ORM 字段 order_quantity） */
  order_quantity?: number;
  delivery_date?: string;
  delivered_quantity?: number;
  remaining_quantity?: number;
  delivery_status?: string;
  unit_price?: number;
  /** 税率（%） */
  tax_rate?: number;
  item_amount?: number;
  is_gift?: boolean;
  gift_ref_unit_price?: number;
  work_order_id?: number;
  work_order_code?: string;
  /** 属性（配置件专用，如 {"color":"red","size":"M"}） */
  variant_attributes?: Record<string, unknown>;
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
  /** 生命周期阶段（与列表 UniLifecycle 展示一致） */
  lifecycle_stage?: string;
  start_date?: string;
  end_date?: string;
  customer_id?: number;
  customer_name?: string;
  order_code?: string;
  contract_code?: string;
  salesman_id?: number;
  keyword?: string;
  order_by?: string;
  include_items?: boolean;
  /** 仅可加载建单；需配合 pull_target */
  pullable_only?: boolean;
  /** 加载目标：sales_order_change / after_sales_ticket / sales_return */
  pull_target?: 'sales_order_change' | 'after_sales_ticket' | 'sales_return' | 'shipment_notice' | 'sales_delivery' | 'demand_computation';
  /** options=选单轻量列表（跳过进度/capabilities；可配合 include_items） */
  view?: 'options';
  /** 高级搜索 / 列筛选 JSON */
  column_filters?: string;
  /** 列表范围：all 全部 / mine 我的 / department 我的部门 */
  list_scope?: 'all' | 'mine' | 'department';
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
  // 新增指标
  today_new_count?: number;
  today_new_amount?: number;
  unfulfilled_count?: number;
  annual_total_amount?: number;
  avg_delivery_cycle?: number;
  // 趋势数据（mock使用或由后端支持）
  trends?: {
    today_new?: number[];
    today_new_amount?: number[];
    unfulfilled?: number[];
    annual_total?: number[];
  };
  /** 年度总额同比（百分比，如 12.5 表示 12.5%） */
  annual_total_yoy?: number;
  /** 昨日今日新签单数 */
  yesterday_today_new?: number;
  /** 昨日今日新签金额 */
  yesterday_today_amount?: number;
  /** 昨日逾期数 */
  yesterday_overdue?: number;
  /** 昨日未履约数 */
  yesterday_unfulfilled?: number;
  /** 昨日待审核数 */
  yesterday_pending_review?: number;
  /** 近7天趋势（{ date, value }[] 格式，用于 Area 折线图） */
  trend_today_new?: { date: string; value: number }[];
  trend_today_amount?: { date: string; value: number }[];
  trend_overdue?: { date: string; value: number }[];
  trend_unfulfilled?: { date: string; value: number }[];
  trend_pending_review?: { date: string; value: number }[];
  trend_annual?: { date: string; value: number }[];
}

/** 获取销售订单统计 */
export async function getSalesOrderStatistics(
  params: { list_scope?: 'all' | 'mine' | 'department' } = {},
): Promise<SalesOrderStatistics> {
  return apiRequest<SalesOrderStatistics>('/apps/kuaizhizao/sales-orders/statistics', {
    method: 'GET',
    params,
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

export type SalesOrderGetOptions = {
  /** options=选单轻量详情（跳过里程碑/账款/capabilities） */
  view?: 'options';
};

/**
 * 获取销售订单详情
 */
export async function getSalesOrder(
  id: number,
  includeItems: boolean = false,
  includeDuration: boolean = false,
  options: SalesOrderGetOptions = {},
): Promise<SalesOrder> {
  return apiRequest<SalesOrder>(`/apps/kuaizhizao/sales-orders/${id}`, {
    method: 'GET',
    params: {
      include_items: includeItems,
      include_duration: includeDuration,
      ...(options.view ? { view: options.view } : {}),
    },
  });
}

export interface QuoteItemResponse {
  item_type: 'material' | 'labor' | 'overhead';
  name: string;
  code?: string;
  quantity: number;
  unit?: string;
  unit_cost: number;
  total_cost: number;
  remark?: string;
}

export interface QuoteBreakdownResponse {
  material_id: number;
  material_code: string;
  material_name: string;
  material_spec?: string;
  material_costs: QuoteItemResponse[];
  manufacturing_costs: QuoteItemResponse[];
  total_material_cost: number;
  total_manufacturing_cost: number;
  total_estimated_cost: number;
  suggested_price: number;
}

/**
 * 获取产品快速核价明细
 */
export async function getQuoteBreakdown(materialId: number): Promise<QuoteBreakdownResponse> {
  return apiRequest<QuoteBreakdownResponse>(`/apps/kuaizhizao/sales-orders/quote-breakdown/${materialId}`, {
    method: 'GET',
  });
}

/** 销售订单全息追踪视图数据结构 */
export interface TrackingWorkOrderInfo {
  work_order_id: number;
  work_order_code: string;
  product_name: string;
  quantity: number;
  completed_quantity: number;
  status: string;
}

export interface TrackingDeliveryInfo {
  delivery_id: number;
  delivery_code: string;
  delivery_date: string | null;
  status: string;
}

export interface TrackingMaterialShortageInfo {
  material_code: string;
  material_name: string;
  required_quantity: number;
  shortage_quantity: number;
}

export interface SalesOrderTrackingResponse {
  sales_order_id: number;
  sales_order_code: string;
  material_prep_progress: number;
  production_progress: number;
  delivery_progress: number;
  work_orders: TrackingWorkOrderInfo[];
  deliveries: TrackingDeliveryInfo[];
  material_shortages: TrackingMaterialShortageInfo[];
}

/**
 * 获取销售订单全息追踪视图
 */
export async function getSalesOrderTracking(salesOrderId: number): Promise<SalesOrderTrackingResponse> {
  return apiRequest<SalesOrderTrackingResponse>(`/apps/kuaizhizao/sales-orders/${salesOrderId}/tracking`, {
    method: 'GET',
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
  items: {
    item_id?: number;
    material_id?: number;
    material_code: string;
    material_name: string;
    quantity: number;
    pushed_quantity?: number;
    max_push_quantity?: number;
    delivery_date?: string;
    suggested_action?: string;
    warehouse_id?: number;
    warehouse_name?: string;
    source_type?: string;
    blocking_issues?: string[];
    has_bom?: boolean;
  }[];
  tip?: string;
  plan_name_preview?: string;
  demand_exists?: boolean;
  has_blocking_issues?: boolean;
  blocking_reason?: string | null;
  push_mode_default?: 'draft' | 'confirm';
  line_warehouse_required?: boolean;
  warehouse_required?: boolean;
  warehouse_id?: number;
  warehouse_name?: string;
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

export interface PushToComputationRequest {
  selected_item_ids?: number[];
  selected_quantities?: Record<number, number>;
}

export async function pushSalesOrderToComputation(
  salesOrderId: number,
  data?: PushToComputationRequest,
): Promise<PushToComputationResponse> {
  return apiRequest<PushToComputationResponse>(`/apps/kuaizhizao/sales-orders/${salesOrderId}/push-to-computation`, {
    method: 'POST',
    data,
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
  status?: string;
  sales_delivery_id?: number;
  sales_delivery_code?: string;
}

export interface PushToShipmentNoticeRequest {
  selected_item_ids?: number[];
  selected_quantities?: Record<number, number>;
  line_warehouses?: Record<number, number>;
  warehouse_id?: number;
  warehouse_name?: string;
}

export type SalesOrderShipmentPullLine = {
  id: number;
  sales_order_id: number;
  order_code?: string;
  customer_id?: number;
  customer_name?: string;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string | null;
  unit?: string;
  suggested_quantity?: number;
  pushed_quantity?: number;
  remaining_quantity?: number;
  required_date?: string | null;
};

export async function listSalesOrderShipmentNoticePullLines(params: {
  skip?: number;
  limit?: number;
  keyword?: string;
  sales_order_id?: number;
  pullable_only?: boolean;
}): Promise<{ data: SalesOrderShipmentPullLine[]; total: number }> {
  return apiRequest('/apps/kuaizhizao/sales-orders/shipment-notice-pull-lines', {
    method: 'GET',
    params,
  });
}

export async function pullShipmentNoticesFromSalesOrderItems(
  selectedItemIds: number[],
): Promise<{
  success: boolean;
  message: string;
  notice_id?: number;
  notice_code?: string;
  notices?: Array<{ notice_id: number; notice_code: string }>;
}> {
  return apiRequest('/apps/kuaizhizao/shipment-notices/pull-from-sales-order-items', {
    method: 'POST',
    data: { selected_item_ids: selectedItemIds },
  });
}

export async function previewPushSalesOrderToShipmentNotice(salesOrderId: number): Promise<PushPreviewResponse> {
  return apiRequest<PushPreviewResponse>(`/apps/kuaizhizao/sales-orders/${salesOrderId}/push-to-shipment-notice/preview`, {
    method: 'GET',
  });
}

export async function pushSalesOrderToShipmentNotice(
  salesOrderId: number,
  data?: PushToShipmentNoticeRequest,
): Promise<PushToShipmentNoticeResponse> {
  return apiRequest<PushToShipmentNoticeResponse>(`/apps/kuaizhizao/sales-orders/${salesOrderId}/push-to-shipment-notice`, {
    method: 'POST',
    data,
  });
}

export interface PushToDeliveryResponse {
  success: boolean;
  message: string;
  delivery_id?: number;
  delivery_code?: string;
}

export interface PushToDeliveryRequest {
  delivery_quantities?: Record<number, number>;
  line_warehouses?: Record<number, number>;
  warehouse_id?: number;
  warehouse_name?: string;
  /** 出库备注，写入销售出库单 notes，仓库出库详情可见 */
  notes?: string;
}

export async function previewPushSalesOrderToDelivery(salesOrderId: number): Promise<PushPreviewResponse> {
  return apiRequest<PushPreviewResponse>(`/apps/kuaizhizao/sales-orders/${salesOrderId}/push-to-delivery/preview`, {
    method: 'GET',
  });
}

export async function pushSalesOrderToDelivery(
  salesOrderId: number,
  data?: PushToDeliveryRequest,
): Promise<PushToDeliveryResponse> {
  return apiRequest<PushToDeliveryResponse>(`/apps/kuaizhizao/sales-orders/${salesOrderId}/push-to-delivery`, {
    method: 'POST',
    data: data ?? {},
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

export async function previewPushSalesOrderToInvoice(salesOrderId: number): Promise<PushPreviewResponse> {
  return apiRequest<PushPreviewResponse>(`/apps/kuaizhizao/sales-orders/${salesOrderId}/push-to-invoice/preview`, {
    method: 'GET',
  });
}

export async function previewBackfillSalesContract(salesOrderId: number): Promise<PushPreviewResponse> {
  return apiRequest<PushPreviewResponse>(
    `/apps/kuaizhizao/sales-orders/${salesOrderId}/backfill-sales-contract/preview`,
    { method: 'GET' },
  );
}

export async function pushSalesOrderToInvoice(salesOrderId: number): Promise<PushToInvoiceResponse> {
  return apiRequest<PushToInvoiceResponse>(`/apps/kuaizhizao/sales-orders/${salesOrderId}/push-to-invoice`, {
    method: 'POST',
  });
}

export interface PushToSalesReturnResponse {
  success?: boolean;
  message?: string;
  return_id?: number;
  return_code?: string;
}

export async function previewPushSalesOrderToSalesReturn(salesOrderId: number): Promise<PushPreviewResponse> {
  return apiRequest<PushPreviewResponse>(`/apps/kuaizhizao/sales-orders/${salesOrderId}/push-to-sales-return/preview`, {
    method: 'GET',
  });
}

export async function pushSalesOrderToSalesReturn(
  salesOrderId: number,
  data: {
  warehouse_id: number;
  warehouse_name?: string;
  return_quantities?: Record<number, number>;
  batch_numbers?: Record<number, string>;
  return_code?: string;
}): Promise<PushToSalesReturnResponse> {
  return apiRequest<PushToSalesReturnResponse>(`/apps/kuaizhizao/sales-orders/${salesOrderId}/push-to-sales-return`, {
    method: 'POST',
    data,
  });
}

export interface PullFromQuotationResponse {
  success: boolean;
  message: string;
  source_type: 'quotation';
  source_id: number;
  sales_order: SalesOrder;
  quotation: {
    id?: number;
    quotation_code?: string;
    status?: string;
    [key: string]: any;
  };
}

export async function pullSalesOrderFromQuotation(quotationId: number): Promise<PullFromQuotationResponse> {
  return apiRequest<PullFromQuotationResponse>('/apps/kuaizhizao/sales-orders/pull-from-quotation', {
    method: 'POST',
    data: { quotation_id: quotationId },
  });
}

export interface PullFromSalesContractResponse {
  success: boolean;
  message: string;
  source_type: 'sales_contract';
  source_id: number;
  sales_order: SalesOrder;
  sales_contract: {
    id?: number;
    contract_code?: string;
    status?: string;
    [key: string]: any;
  };
}

export async function pullSalesOrderFromSalesContract(
  contractId: number,
  data?: { selected_item_ids?: number[]; release_lines?: Array<Record<string, unknown>> },
): Promise<PullFromSalesContractResponse> {
  return apiRequest<PullFromSalesContractResponse>('/apps/kuaizhizao/sales-orders/pull-from-sales-contract', {
    method: 'POST',
    data: {
      contract_id: contractId,
      ...(data || {}),
    },
  });
}

export interface PullFromSalesReviewResponse {
  success: boolean;
  message: string;
  source_type: 'sales_review';
  source_id: number;
  sales_order_id?: number;
  sales_order_code?: string;
  sales_order?: SalesOrder;
}

export async function pullSalesOrderFromSalesReview(reviewId: number): Promise<PullFromSalesReviewResponse> {
  return apiRequest<PullFromSalesReviewResponse>('/apps/kuaizhizao/sales-orders/pull-from-sales-review', {
    method: 'POST',
    data: { sales_review_id: reviewId },
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

export interface PushToWorkOrderRequest {
  push_mode?: 'draft' | 'confirm';
  work_order_granularity?: 'grouped' | 'peer_group';
  selected_item_ids?: number[];
  selected_quantities?: Record<number, number>;
  selected_work_centers?: Record<number, number>;
}

export async function pushSalesOrderToWorkOrder(
  salesOrderId: number,
  data?: PushToWorkOrderRequest,
): Promise<PushToWorkOrderResponse> {
  return apiRequest<PushToWorkOrderResponse>(`/apps/kuaizhizao/sales-orders/${salesOrderId}/push-to-work-order`, {
    method: 'POST',
    data,
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
    data: ids,
  });
}

/**
 * 批量提交销售订单
 */
export async function bulkSubmitSalesOrders(ids: number[]): Promise<{
  success_count: number;
  failed_count: number;
  failed_items: { id: number; reason: string }[];
}> {
  return apiRequest('/apps/kuaizhizao/sales-orders/batch-submit', {
    method: 'POST',
    data: ids,
  });
}

/**
 * 批量审核通过销售订单
 */
export async function bulkApproveSalesOrders(ids: number[]): Promise<{
  success_count: number;
  failed_count: number;
  failed_items: { id: number; reason: string }[];
}> {
  return apiRequest('/apps/kuaizhizao/sales-orders/batch-approve', {
    method: 'POST',
    data: ids,
  });
}

/**
 * 批量撤回销售订单
 */
export async function bulkWithdrawSalesOrders(ids: number[]): Promise<{
  success_count: number;
  failed_count: number;
  failed_items: { id: number; reason: string }[];
}> {
  return apiRequest('/apps/kuaizhizao/sales-orders/batch-withdraw', {
    method: 'POST',
    data: ids,
  });
}

/**
 * 批量反审核销售订单
 */
export async function bulkUnapproveSalesOrders(ids: number[]): Promise<{
  success_count: number;
  failed_count: number;
  failed_items: { id: number; reason: string }[];
}> {
  return apiRequest('/apps/kuaizhizao/sales-orders/batch-unapprove', {
    method: 'POST',
    data: ids,
  });
}

/**
 * 批量关闭销售订单（终止剩余未执行部分）
 */
export async function bulkCloseSalesOrders(ids: number[]): Promise<{
  success_count: number;
  failed_count: number;
  failed_items: { id: number; reason: string }[];
}> {
  return apiRequest('/apps/kuaizhizao/sales-orders/batch-close', {
    method: 'POST',
    data: ids,
  });
}

/**
 * 批量撤回关闭销售订单（恢复关闭前状态）
 */
export async function bulkReopenSalesOrders(ids: number[]): Promise<{
  success_count: number;
  failed_count: number;
  failed_items: { id: number; reason: string }[];
}> {
  return apiRequest('/apps/kuaizhizao/sales-orders/batch-reopen', {
    method: 'POST',
    data: ids,
  });
}

/**
 * 撤回关闭销售订单
 */
export async function reopenSalesOrder(id: number): Promise<SalesOrder> {
  return apiRequest(`/apps/kuaizhizao/sales-orders/${id}/reopen`, {
    method: 'POST',
  });
}

export async function generateSalesOrderMilestoneReceivable(
  salesOrderId: number,
  milestoneId: number,
): Promise<unknown> {
  return apiRequest(
    `/apps/kuaizhizao/sales-orders/${salesOrderId}/milestones/${milestoneId}/generate-receivable`,
    { method: 'POST' },
  );
}

/** 销售订单行价格趋势（按客户 + 物料） */
export interface SalesOrderPriceTrendResponse {
  side: 'sales';
  material_id: number;
  partner_id: number;
  partner_name?: string | null;
  history_items: Array<{
    order_id: number;
    order_code: string;
    order_date: string;
    partner_id: number;
    partner_name: string;
    unit_price: number;
    quantity?: number;
  }>;
  trend_points: Array<{ date: string; price: number; order_code: string }>;
  average_price: number;
  min_price: number;
  max_price: number;
}

export async function getSalesOrderPriceTrend(params: {
  materialId: number;
  customerId: number;
  limit?: number;
}): Promise<SalesOrderPriceTrendResponse> {
  return apiRequest<SalesOrderPriceTrendResponse>('/apps/kuaizhizao/sales-orders/price-trend', {
    method: 'GET',
    params: {
      material_id: params.materialId,
      customer_id: params.customerId,
      limit: params.limit,
    },
  });
}

export type SalesOrderSyncSourceType = 'api' | 'dataset';

export interface SalesOrderSyncBinding {
  source_type?: SalesOrderSyncSourceType | null;
  api_uuid?: string | null;
  dataset_uuid?: string | null;
  field_mapping: Record<string, string>;
  match_key_field: string;
  sync_mode: string;
  schedule_interval_minutes?: number;
  last_success_at?: string | null;
  last_attempt_at?: string | null;
  last_error?: string | null;
}

export interface SalesOrderSyncFromSourcePayload {
  source_type?: SalesOrderSyncSourceType;
  api_uuid?: string;
  dataset_uuid?: string;
  field_mapping?: Record<string, string>;
  save_binding?: boolean;
  sync_mode?: string;
  schedule_interval_minutes?: number;
  incremental?: boolean;
  active_only?: boolean;
  skip_prerequisite_syncs?: boolean;
}

export interface SalesOrderSyncFromSourceResult {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export async function getSalesOrderSyncBinding(): Promise<SalesOrderSyncBinding> {
  return apiRequest<SalesOrderSyncBinding>('/apps/kuaizhizao/sales-orders/sync-binding');
}

export async function putSalesOrderSyncBinding(
  payload: Partial<SalesOrderSyncBinding>,
): Promise<SalesOrderSyncBinding> {
  return apiRequest<SalesOrderSyncBinding>('/apps/kuaizhizao/sales-orders/sync-binding', {
    method: 'PUT',
    data: payload,
  });
}

export async function syncSalesOrdersFromSource(
  payload: SalesOrderSyncFromSourcePayload,
  onProgress?: (message: string) => void,
): Promise<SalesOrderSyncFromSourceResult> {
  const { apiRequestSyncNdjson } = await import(
    '../../../components/sync-from-source-modal/apiRequestSyncNdjson'
  );
  return apiRequestSyncNdjson<SalesOrderSyncFromSourceResult>(
    '/apps/kuaizhizao/sales-orders/sync-from-source',
    {
      data: payload,
      timeoutMs: 600_000,
      onProgress,
    },
  );
}

