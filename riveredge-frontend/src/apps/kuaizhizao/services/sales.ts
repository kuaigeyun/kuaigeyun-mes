/**
 * 销售管理API服务
 *
 * 提供销售订单相关的API调用接口
 *
 * @author RiverEdge Team
 * @date 2025-12-29
 */

import { apiRequest } from '../../../services/api';

/**
 * 销售订单接口定义
 */
export interface SalesOrder {
  id?: number;
  orderCode?: string;
  customerId: number;
  customerName?: string;
  orderType: 'MTO' | 'MTS';
  status?: 'draft' | 'confirmed' | 'processing' | 'completed' | 'cancelled';
  orderDate?: string;
  deliveryDate: string;
  totalAmount?: number;
  totalQuantity?: number;
  remarks?: string;
  items: SalesOrderItem[];
}

export interface SalesOrderItem {
  id?: number;
  productId: number;
  productCode?: string;
  productName?: string;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
  deliveryDate: string;
}

export interface SalesOrderListParams {
  skip?: number;
  limit?: number;
  orderType?: 'MTO' | 'MTS';
  status?: string;
  customerId?: number;
  startDate?: string;
  endDate?: string;
  keyword?: string;
}

export interface SalesOrderListResponse {
  data: SalesOrder[];
  total: number;
  success: boolean;
}

/**
 * 获取销售订单列表
 */
export async function listSalesOrders(params: SalesOrderListParams = {}): Promise<SalesOrderListResponse> {
  return apiRequest<SalesOrderListResponse>({
    url: '/apps/kuaizhizao/sales-management/sales-orders',
    method: 'GET',
    params,
  });
}

/**
 * 创建销售订单
 */
export async function createSalesOrder(data: SalesOrder): Promise<SalesOrder> {
  return apiRequest<SalesOrder>({
    url: '/apps/kuaizhizao/sales-management/sales-orders',
    method: 'POST',
    data,
  });
}

/**
 * 获取销售订单详情
 */
export async function getSalesOrder(id: number): Promise<SalesOrder> {
  return apiRequest<SalesOrder>({
    url: `/apps/kuaizhizao/sales-management/sales-orders/${id}`,
    method: 'GET',
  });
}

/**
 * 更新销售订单
 */
export async function updateSalesOrder(id: number, data: Partial<SalesOrder>): Promise<SalesOrder> {
  return apiRequest<SalesOrder>({
    url: `/apps/kuaizhizao/sales-management/sales-orders/${id}`,
    method: 'PUT',
    data,
  });
}

/**
 * 删除销售订单
 */
export async function deleteSalesOrder(id: number): Promise<void> {
  return apiRequest<void>({
    url: `/apps/kuaizhizao/sales-management/sales-orders/${id}`,
    method: 'DELETE',
  });
}

/**
 * 批量导入销售订单
 */
export async function importSalesOrders(file: File): Promise<{ success: boolean; message: string; data?: any }> {
  const formData = new FormData();
  formData.append('file', file);

  return apiRequest<{ success: boolean; message: string; data?: any }>({
    url: '/apps/kuaizhizao/sales-management/sales-orders/import',
    method: 'POST',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
}

/**
 * 确认销售订单
 */
export async function confirmSalesOrder(id: number): Promise<SalesOrder> {
  return apiRequest<SalesOrder>({
    url: `/apps/kuaizhizao/sales-management/sales-orders/${id}/confirm`,
    method: 'POST',
  });
}

/**
 * 取消销售订单
 */
export async function cancelSalesOrder(id: number): Promise<SalesOrder> {
  return apiRequest<SalesOrder>({
    url: `/apps/kuaizhizao/sales-management/sales-orders/${id}/cancel`,
    method: 'POST',
  });
}
