/**
 * 采购订单API服务
 *
 * 提供采购订单相关的API调用接口
 *
 * @author RiverEdge Team
 * @date 2025-01-01
 */

import { apiRequest } from '../../../services/api';

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
  notes?: string;
  items_count?: number;
  created_at?: string;
  updated_at?: string;
  items?: PurchaseOrderItem[];
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
  quality_requirements?: string;
  inspection_required?: boolean;
  source_type?: string;
  source_id?: number;
  notes?: string;
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
  keyword?: string;
}

export interface PurchaseOrderListResponse {
  data: PurchaseOrder[];
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
  return apiRequest<PurchaseOrderListResponse>('/apps/kuaizhizao/purchase-orders', {
    method: 'GET',
    params,
  });
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

/**
 * 下推到采购入库
 */
export async function pushPurchaseOrderToReceipt(id: number, receiptQuantities?: Record<number, number>): Promise<any> {
  return apiRequest<any>(`/apps/kuaizhizao/purchase-orders/${id}/push-to-receipt`, {
    method: 'POST',
    data: receiptQuantities || {},
  });
}

