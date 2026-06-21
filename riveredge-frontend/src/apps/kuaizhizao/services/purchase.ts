/**
 * 采购订单API服务
 *
 * 提供采购订单相关的API调用接口
 *
 * @author RiverEdge Team
 * @date 2025-01-01
 */

import { apiRequest } from '../../../services/api';

const PURCHASE_ORDER_LIST_LIMIT_MAX = 100;

function clampPurchaseOrderListLimit(limit: unknown): number | undefined {
  if (typeof limit !== 'number' || Number.isNaN(limit)) return undefined;
  return Math.max(1, Math.min(PURCHASE_ORDER_LIST_LIMIT_MAX, Math.trunc(limit)));
}

export interface ActionCapability {
  allowed: boolean;
  reason?: string | null;
}

export interface PurchaseOrderCapabilities {
  update?: ActionCapability;
  delete?: ActionCapability;
  submit?: ActionCapability;
  withdraw_submit?: ActionCapability;
  approve?: ActionCapability;
  revoke_approval?: ActionCapability;
  push_receipt_notice?: ActionCapability;
  print?: ActionCapability;
}

/**
 * 采购订单接口定义
 */
export interface PurchaseOrder {
  id?: number;
  tenant_id?: number;
  order_code?: string;
  supplier_id?: number;
  supplier_name?: string;
  supplier_contact?: string;
  supplier_phone?: string;
  order_date?: string;
  delivery_date?: string;
  order_type?: string;
  total_quantity?: number;
  total_amount?: number;
  tax_rate?: number;
  tax_amount?: number;
  net_amount?: number;
  currency?: string;
  exchange_rate?: number;
  status?: string;
  source_type?: string;
  source_id?: number;
  review_status?: string;
  reviewer_id?: number;
  reviewer_name?: string;
  review_time?: string;
  review_remarks?: string;
  buyer_id?: number;
  buyer_name?: string;
  notes?: string;
  items_count?: number;
  created_at?: string;
  updated_at?: string;
  items?: PurchaseOrderItem[];
  /** 变更原因 (V2 审计) */
  change_reason?: string;
  fee_details?: any[];
  total_fee_amount?: number;
  capabilities?: PurchaseOrderCapabilities;
}

export interface PurchaseOrderItem {
  id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  ordered_quantity?: number;
  unit?: string;
  unit_price?: number;
  total_price?: number;
  received_quantity?: number;
  outstanding_quantity?: number;
  required_date?: string;
  actual_delivery_date?: string;
  source_id?: number;
  notes?: string;
  /** 分摊落地成本 (V2) */
  landing_cost?: number;
  /** 杂费明细 (V2) */
  additional_fees_details?: LandingCostFeeItem[];
  capabilities?: PurchaseOrderCapabilities;
}

export interface PurchaseOrderListParams {
  skip?: number;
  limit?: number;
  supplier_id?: number;
  status?: string;
  review_status?: string;
  order_date_from?: string;
  order_date_to?: string;
  delivery_date_from?: string;
  delivery_date_to?: string;
  buyer_id?: number;
  keyword?: string;
}

export interface PurchaseOrderListResponse {
  data: PurchaseOrder[];
  total: number;
  success: boolean;
}

/** 采购入库选单弹窗候选项 */
export interface PurchaseReceiptPullCandidate {
  id: number;
  order_code: string;
  supplier_name?: string;
  status: string;
  order_date?: string;
  delivery_date?: string;
  items_count?: number;
  ordered_total?: number;
  received_total?: number;
  outstanding_total?: number;
  pullable: boolean;
  lifecycle?: {
    current_stage_name?: string;
    sub_stages?: Array<{ key: string; label: string; status: string }>;
  };
}

export interface PurchaseReceiptPullCandidateListResponse {
  data: PurchaseReceiptPullCandidate[];
  total: number;
  success: boolean;
}

/** 采购订单统计（用于指标卡片） */
export interface PurchaseOrderStatistics {
  active_count: number;
  pending_review_count: number;
  in_progress_count: number;
  overdue_count: number;
  total_amount: number;
  // 新增指标
  monthly_arrival_rate?: number;
  annual_total_amount?: number;
  supplier_on_time_rate?: number;
  // 趋势数据
  trends?: {
    overdue?: number[];
    arrival_rate?: number[];
    annual_total?: number[];
    efficiency?: number[];
  };
  /** 效率同比（百分比） */
  efficiency_yoy?: number;
  /** 年度总额同比（百分比，如 12.5 表示 12.5%） */
  annual_total_yoy?: number;
}

/** 获取采购订单统计 */
export async function getPurchaseOrderStatistics(): Promise<PurchaseOrderStatistics> {
  return apiRequest<PurchaseOrderStatistics>('/apps/kuaizhizao/purchase-orders/statistics', {
    method: 'GET',
  });
}

/**
 * 获取采购订单列表
 */
export async function listPurchaseOrders(params: PurchaseOrderListParams = {}): Promise<PurchaseOrderListResponse> {
  const limit = clampPurchaseOrderListLimit(params.limit);
  const safeParams = limit != null ? { ...params, limit } : params;
  return apiRequest<PurchaseOrderListResponse>('/apps/kuaizhizao/purchase-orders', {
    method: 'GET',
    params: safeParams,
  });
}

/** 采购入库选单弹窗：单次请求返回订单及入库数量汇总 */
export async function listPurchaseReceiptPullCandidates(params: {
  skip?: number;
  limit?: number;
  keyword?: string;
} = {}): Promise<PurchaseReceiptPullCandidateListResponse> {
  const limit = typeof params.limit === 'number'
    ? Math.max(1, Math.min(200, Math.trunc(params.limit)))
    : 100;
  return apiRequest<PurchaseReceiptPullCandidateListResponse>(
    '/apps/kuaizhizao/purchase-orders/receipt-pull-candidates',
    {
      method: 'GET',
      params: { ...params, limit },
    },
  );
}

/**
 * 获取采购订单详情
 */
export async function getPurchaseOrder(id: number): Promise<PurchaseOrder> {
  return apiRequest<PurchaseOrder>(`/apps/kuaizhizao/purchase-orders/${id}`, {
    method: 'GET',
  });
}

/**
 * 创建采购订单
 */
export async function createPurchaseOrder(data: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
  return apiRequest<PurchaseOrder>('/apps/kuaizhizao/purchase-orders', {
    method: 'POST',
    data,
  });
}

/**
 * 更新采购订单
 */
export async function updatePurchaseOrder(id: number, data: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
  return apiRequest<PurchaseOrder>(`/apps/kuaizhizao/purchase-orders/${id}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除采购订单
 */
export async function deletePurchaseOrder(id: number): Promise<void> {
  return apiRequest<void>(`/apps/kuaizhizao/purchase-orders/${id}`, {
    method: 'DELETE',
  });
}

/**
 * 审核采购订单
 */
/**
 * 审核采购订单请求接口
 */
export interface PurchaseOrderApproveRequest {
  approved: boolean;
  review_remarks?: string;
}

/**
 * 审核采购订单
 */
export async function approvePurchaseOrder(id: number, data: PurchaseOrderApproveRequest): Promise<PurchaseOrder> {
  return apiRequest<PurchaseOrder>(`/apps/kuaizhizao/purchase-orders/${id}/approve`, {
    method: 'POST',
    data,
  });
}

/**
 * 确认采购订单
 */
export async function confirmPurchaseOrder(id: number): Promise<PurchaseOrder> {
  return apiRequest<PurchaseOrder>(`/apps/kuaizhizao/purchase-orders/${id}/confirm`, {
    method: 'POST',
  });
}

/**
 * 提交采购订单（非审核）
 */
export async function submitPurchaseOrder(id: number): Promise<PurchaseOrder> {
  return apiRequest<PurchaseOrder>(`/apps/kuaizhizao/purchase-orders/${id}/submit`, {
    method: 'POST',
  });
}

/** 撤回提交（待审核 -> 草稿），走统一审核入口 */
export async function withdrawPurchaseOrder(id: number): Promise<PurchaseOrder> {
  return apiRequest<PurchaseOrder>(`/core/uni-audit/purchase_order/${id}/withdraw`, {
    method: 'POST',
  });
}

/** 撤销审核（已确认/已驳回 -> 待审核），走统一审核入口 */
export async function revokePurchaseOrder(id: number): Promise<PurchaseOrder> {
  return apiRequest<PurchaseOrder>(`/core/uni-audit/purchase_order/${id}/revoke`, {
    method: 'POST',
  });
}

/**
 * 下推采购入库预览（返回批号等，供弹窗展示）
 */
export async function pushPurchaseOrderToReceiptPreview(
  id: number,
  receiptQuantities?: Record<number, number>
): Promise<{ items: Array<{ item_id: number; material_code: string; material_name: string; receipt_quantity: number; batch_number?: string }> }> {
  return apiRequest<any>(`/apps/kuaizhizao/purchase-orders/${id}/push-to-receipt-preview`, {
    method: 'POST',
    data: receiptQuantities || {},
  });
}

export type PushPurchaseOrderToReceiptOptions = {
  warehouseId?: number;
  lineWarehouses?: Record<number, number>;
  lineLocationIds?: Record<number, number>;
  lineLocationCodes?: Record<number, string>;
};

/**
 * 下推到采购入库
 */
export async function pushPurchaseOrderToReceipt(
  id: number,
  receiptQuantities?: Record<number, number>,
  batchNumbers?: Record<number, string>,
  options?: number | PushPurchaseOrderToReceiptOptions,
): Promise<any> {
  const opts: PushPurchaseOrderToReceiptOptions =
    typeof options === 'number' ? { warehouseId: options } : (options ?? {});
  return apiRequest<any>(`/apps/kuaizhizao/purchase-orders/${id}/push-to-receipt`, {
    method: 'POST',
    data: {
      receipt_quantities: receiptQuantities || {},
      ...(batchNumbers && Object.keys(batchNumbers).length > 0 ? { batch_numbers: batchNumbers } : {}),
      ...(opts.warehouseId != null && opts.warehouseId > 0 ? { warehouse_id: opts.warehouseId } : {}),
      ...(opts.lineWarehouses && Object.keys(opts.lineWarehouses).length > 0
        ? { line_warehouses: opts.lineWarehouses }
        : {}),
      ...(opts.lineLocationIds && Object.keys(opts.lineLocationIds).length > 0
        ? { line_location_ids: opts.lineLocationIds }
        : {}),
      ...(opts.lineLocationCodes && Object.keys(opts.lineLocationCodes).length > 0
        ? { line_location_codes: opts.lineLocationCodes }
        : {}),
    },
  });
}

/**
 * 下推到收货通知
 */
export async function pushPurchaseOrderToReceiptNotice(id: number, noticeQuantities?: Record<number, number>): Promise<any> {
  return apiRequest<any>(`/apps/kuaizhizao/purchase-orders/${id}/push-to-receipt-notice`, {
    method: 'POST',
    data: noticeQuantities || {},
  });
}

/**
 * 下推到采购发票
 */
export async function pushPurchaseOrderToInvoice(id: number): Promise<any> {
  return apiRequest<any>(`/apps/kuaizhizao/purchase-orders/${id}/push-to-invoice`, {
    method: 'POST',
  });
}

export async function pushPurchaseOrderToPurchaseReturn(data: {
  purchase_order_id: number;
  warehouse_id: number;
  warehouse_name?: string;
  return_quantities?: Record<number, number>;
}): Promise<{ id: number; return_code?: string }> {
  return apiRequest<{ id: number; return_code?: string }>('/apps/kuaizhizao/purchase-returns/pull-from-purchase-order', {
    method: 'POST',
    data,
  });
}

export async function pullPurchaseOrderFromInquiry(data: {
  inquiry_id: number;
  item_ids?: number[];
  persist_default_supplier_to_material?: boolean;
}): Promise<{ purchase_orders?: Array<{ purchase_order_id: number; purchase_order_code: string; supplier_id: number }> }> {
  return apiRequest('/apps/kuaizhizao/purchase-orders/pull-from-inquiry', {
    method: 'POST',
    data,
  });
}

/** 物料价格历史响应接口 */
export interface MaterialPriceHistoryResponse {
  material_id: number;
  history_items: Array<{
    order_id: number;
    order_code: string;
    order_date: string;
    supplier_id: number;
    supplier_name: string;
    unit_price: number;
    currency: string;
  }>;
  average_price: number;
  min_price: number;
  max_price: number;
}

/** 采购追踪响应接口 */
export interface PurchaseTrackingResponse {
  order_id: number;
  order_code: string;
  overall_progress: number;
  nodes: Array<{
    node_name: string;
    status: string;
    time?: string;
    operator?: string;
    detail?: string;
    is_completed: boolean;
    is_warning: boolean;
  }>;
}

/** 获取物料历史成交价 */
export async function getMaterialPriceHistory(materialId: number): Promise<MaterialPriceHistoryResponse> {
  return apiRequest<MaterialPriceHistoryResponse>(`/apps/kuaizhizao/material-price-history/${materialId}`, {
    method: 'GET',
  });
}

/** 获取采购订单履约追踪 */
export async function getPurchaseOrderTracking(orderId: number): Promise<PurchaseTrackingResponse> {
  return apiRequest<PurchaseTrackingResponse>(`/apps/kuaizhizao/purchase-orders/${orderId}/tracking`, {
    method: 'GET',
  });
}

/** 一键催单 */
export async function expeditePurchaseOrder(orderId: number, remarks?: string): Promise<{ success: boolean; message: string }> {
  return apiRequest<any>(`/apps/kuaizhizao/purchase-orders/${orderId}/expedite`, {
    method: 'POST',
    data: { remarks },
  });
}

/** 杂费项 (V2) */
export interface LandingCostFeeItem {
  name: string;
  amount: number;
}

/** 杂费分摊请求 (V2) */
export interface LandingCostAllocationRequest {
  fee_items: LandingCostFeeItem[];
  method: 'by_value' | 'by_quantity' | 'by_weight' | 'by_volume';
}

/** 分摊落地成本 (V2) */
export async function allocatePurchaseCosts(orderId: number, data: LandingCostAllocationRequest): Promise<any> {
  return apiRequest<any>(`/apps/kuaizhizao/purchase-orders/${orderId}/allocate-costs`, {
    method: 'POST',
    data,
  });
}
