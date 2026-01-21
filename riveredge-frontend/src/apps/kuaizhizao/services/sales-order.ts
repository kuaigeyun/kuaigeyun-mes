/**
 * 销售订单管理API服务
 *
 * 提供销售订单相关的API调用接口。
 *
 * @author Luigi Lu
 * @date 2026-01-19
 */

import { apiRequest } from '../../../services/api';

/**
 * 销售订单接口定义
 */
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
}

/**
 * 销售订单列表响应
 */
export interface SalesOrderListResponse {
  data: SalesOrder[];
  total: number;
  success: boolean;
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
 * 驳回销售订单
 */
export async function rejectSalesOrder(id: number, rejectionReason: string): Promise<SalesOrder> {
  return apiRequest<SalesOrder>(`/apps/kuaizhizao/sales-orders/${id}/reject`, {
    method: 'POST',
    params: { rejection_reason: rejectionReason },
  });
}

/**
 * 下推销售订单到需求计算
 */
export interface PushToComputationResponse {
  success: boolean;
  message: string;
  order_code: string;
  computation_code: string;
  note?: string;
}

export async function pushSalesOrderToComputation(salesOrderId: number): Promise<PushToComputationResponse> {
  return apiRequest<PushToComputationResponse>(`/apps/kuaizhizao/sales-orders/${salesOrderId}/push-to-computation`, {
    method: 'POST',
  });
}
