/**
 * 销售管理API服务
 *
 * 提供销售订单相关的API调用接口
 *
 * @author RiverEdge Team
 * @date 2025-12-29
 */

import { api, apiRequest } from '../../../services/api';

// 导出销售预测API（重新导出，方便使用）
export * from './sales-forecast';

/**
 * 销售订单接口定义
 */
export interface SalesOrder {
  id?: number;
  tenant_id?: number;
  order_code?: string;
  customer_id: number;
  customer_name?: string;
  customer_contact?: string;
  customer_phone?: string;
  order_date?: string;
  delivery_date: string;
  order_type: 'MTO' | 'MTS';
  total_quantity?: number;
  total_amount?: number;
  status?: string;
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
  notes?: string;
  created_at?: string;
  updated_at?: string;
  items?: SalesOrderItem[];
}

export interface SalesOrderItem {
  id?: number;
  tenant_id?: number;
  order_id?: number;
  material_id: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  material_unit?: string;
  ordered_quantity: number;
  unit_price: number;
  total_price?: number;
  delivered_quantity?: number;
  delivery_date: string;
  notes?: string;
}

export interface SalesOrderListParams {
  skip?: number;
  limit?: number;
  order_type?: 'MTO' | 'MTS';
  status?: string;
  customer_id?: number;
  start_date?: string;
  end_date?: string;
  keyword?: string;
}

export interface SalesOrderListResponse {
  data: SalesOrder[];
  total: number;
  success: boolean;
}

/**
 * 获取销售订单列表
 * 
 * 注意：使用与基础数据管理APP相同的模式（api.get），返回数组格式
 * 在页面组件的 request 函数中手动包装为 { data, total, success } 格式
 */
export async function listSalesOrders(params: SalesOrderListParams = {}): Promise<SalesOrder[]> {
  return api.get<SalesOrder[]>('/apps/kuaizhizao/sales-orders', { params });
}

/**
 * 创建销售订单
 * 
 * 注意：使用与基础数据管理APP相同的模式（api.post）
 */
export async function createSalesOrder(data: SalesOrder): Promise<SalesOrder> {
  return api.post<SalesOrder>('/apps/kuaizhizao/sales-orders', data);
}

/**
 * 获取销售订单详情
 * 
 * 注意：使用与基础数据管理APP相同的模式（api.get）
 */
export async function getSalesOrder(id: number): Promise<SalesOrder> {
  return api.get<SalesOrder>(`/apps/kuaizhizao/sales-orders/${id}`);
}

/**
 * 更新销售订单
 * 
 * 注意：使用与基础数据管理APP相同的模式（api.put）
 */
export async function updateSalesOrder(id: number, data: Partial<SalesOrder>): Promise<SalesOrder> {
  return api.put<SalesOrder>(`/apps/kuaizhizao/sales-orders/${id}`, data);
}

/**
 * 删除销售订单
 */
export async function deleteSalesOrder(id: number): Promise<void> {
  return apiRequest<void>(
    `/apps/kuaizhizao/sales-orders/${id}`,
    {
      method: 'DELETE',
    }
  );
}

/**
 * 提交销售订单
 */
export async function submitSalesOrder(id: number): Promise<SalesOrder> {
  return apiRequest<SalesOrder>(
    `/apps/kuaizhizao/sales-orders/${id}/submit`,
    {
      method: 'POST',
    }
  );
}

/**
 * 批量导入销售订单（UniSheet方式）
 */
export async function importSalesOrders(data: any[][]): Promise<{ success: boolean; message: string; data?: any }> {
  return apiRequest<{ success: boolean; message: string; data?: any }>(
    '/apps/kuaizhizao/sales-orders/import',
    {
      method: 'POST',
      data: { data },
    }
  );
}

/**
 * 批量导出销售订单
 */
export async function exportSalesOrders(params: SalesOrderListParams = {}): Promise<Blob> {
  return apiRequest<Blob>(
    '/apps/kuaizhizao/sales-orders/export',
    {
      method: 'GET',
      params,
      responseType: 'blob',
    }
  );
}

/**
 * 下推到销售出库
 */
export async function pushSalesOrderToDelivery(id: number, deliveryQuantities?: Record<number, number>): Promise<any> {
  return apiRequest<any>(
    `/apps/kuaizhizao/sales-orders/${id}/push-to-delivery`,
    {
      method: 'POST',
      data: deliveryQuantities || {},
    }
  );
}

/**
 * 确认销售订单
 */
export async function confirmSalesOrder(id: number): Promise<SalesOrder> {
  return apiRequest<SalesOrder>(
    `/apps/kuaizhizao/sales-orders/${id}/confirm`,
    {
      method: 'POST',
    }
  );
}

/**
 * 取消销售订单
 */
export async function cancelSalesOrder(id: number): Promise<SalesOrder> {
  return apiRequest<SalesOrder>(
    `/apps/kuaizhizao/sales-orders/${id}/cancel`,
    {
      method: 'POST',
    }
  );
}
