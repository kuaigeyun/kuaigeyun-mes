/**
 * 售后服务工单 API
 */

import { apiRequest } from '../../../services/api';

export type AfterSalesRequestType = '退货' | '换货' | '维修' | '索赔' | '咨询';
export type AfterSalesTicketStatus = '待处理' | '处理中' | '已关闭';

export interface ActionCapability {
  allowed: boolean;
  reason?: string | null;
}

export interface AfterSalesTicketCapabilities {
  update?: ActionCapability;
  delete?: ActionCapability;
  close?: ActionCapability;
  push_sales_return?: ActionCapability;
  push_repair_order?: ActionCapability;
}

export interface AfterSalesTicketItem {
  id?: number;
  uuid?: string;
  ticket_id?: number;
  material_id?: number | null;
  material_code?: string | null;
  material_name?: string | null;
  material_spec?: string | null;
  material_unit?: string | null;
  sales_order_item_id?: number | null;
  sales_delivery_item_id?: number | null;
  batch_no?: string | null;
  quantity?: number | string | null;
  claim_amount?: number | string | null;
  notes?: string | null;
  line_no?: number;
}

export interface AfterSalesTicket {
  id: number;
  uuid?: string;
  tenant_id?: number;
  ticket_code: string;
  customer_id: number;
  customer_name: string;
  sales_order_id?: number | null;
  sales_order_code?: string | null;
  sales_delivery_id?: number | null;
  sales_delivery_code?: string | null;
  sales_return_id?: number | null;
  sales_return_code?: string | null;
  request_type: AfterSalesRequestType | string;
  status: AfterSalesTicketStatus | string;
  content: string;
  resolution?: string | null;
  claim_amount?: number | string | null;
  registered_at: string;
  closed_at?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by?: number | null;
  updated_by?: number | null;
  created_by_name?: string | null;
  updated_by_name?: string | null;
  items?: AfterSalesTicketItem[];
  item_count?: number;
  existing_repair_order_code?: string | null;
  capabilities?: AfterSalesTicketCapabilities;
}

export interface AfterSalesTicketListResult {
  items: AfterSalesTicket[];
  total: number;
}

export interface AfterSalesTicketListParams {
  skip?: number;
  limit?: number;
  customer_id?: number;
  request_type?: string;
  status?: string;
  keyword?: string;
  sales_order_code?: string;
  registered_from?: string;
  registered_to?: string;
  order_by?: string;
}

export type AfterSalesTicketItemPayload = {
  material_id?: number | null;
  material_code?: string | null;
  material_name?: string | null;
  material_spec?: string | null;
  material_unit?: string | null;
  sales_order_item_id?: number | null;
  sales_delivery_item_id?: number | null;
  batch_no?: string | null;
  quantity?: number | null;
  claim_amount?: number | null;
  notes?: string | null;
};

export interface AfterSalesTicketPushPreviewLine {
  ticket_item_id?: number | null;
  sales_order_item_id?: number | null;
  material_id?: number | null;
  material_code?: string | null;
  material_name?: string | null;
  material_spec?: string | null;
  material_unit?: string | null;
  batch_no?: string | null;
  ticket_quantity?: number | string | null;
  returnable_quantity?: number | string | null;
  return_quantity?: number | string | null;
}

export interface AfterSalesTicketPushPreview {
  ticket_id: number;
  ticket_code: string;
  sales_order_id: number;
  sales_order_code?: string | null;
  has_blocking_issues: boolean;
  blocking_reason?: string | null;
  lines: AfterSalesTicketPushPreviewLine[];
  message?: string | null;
}

export const AFTER_SALES_REQUEST_TYPES: AfterSalesRequestType[] = [
  '退货',
  '换货',
  '维修',
  '索赔',
  '咨询',
];

export const AFTER_SALES_TICKET_STATUSES: AfterSalesTicketStatus[] = [
  '待处理',
  '处理中',
  '已关闭',
];

export const afterSalesTicketApi = {
  list: async (params?: AfterSalesTicketListParams): Promise<AfterSalesTicketListResult> =>
    apiRequest('/apps/kuaizhizao/after-sales-tickets', { method: 'GET', params }),

  get: async (id: number): Promise<AfterSalesTicket> =>
    apiRequest(`/apps/kuaizhizao/after-sales-tickets/${id}`, { method: 'GET' }),

  create: async (data: {
    customer_id: number;
    request_type: string;
    content: string;
    registered_at?: string;
    sales_order_id?: number | null;
    sales_delivery_id?: number | null;
    items?: AfterSalesTicketItemPayload[];
  }): Promise<AfterSalesTicket> =>
    apiRequest('/apps/kuaizhizao/after-sales-tickets', { method: 'POST', data }),

  update: async (
    id: number,
    data: Partial<{
      request_type: string;
      content: string;
      status: string;
      resolution: string | null;
      registered_at: string;
      sales_order_id: number | null;
      sales_delivery_id: number | null;
      items: AfterSalesTicketItemPayload[];
    }>,
  ): Promise<AfterSalesTicket> =>
    apiRequest(`/apps/kuaizhizao/after-sales-tickets/${id}`, { method: 'PUT', data }),

  close: async (id: number, data?: { resolution?: string | null }): Promise<AfterSalesTicket> =>
    apiRequest(`/apps/kuaizhizao/after-sales-tickets/${id}/close`, { method: 'POST', data: data ?? {} }),

  delete: async (id: number): Promise<void> =>
    apiRequest(`/apps/kuaizhizao/after-sales-tickets/${id}`, { method: 'DELETE' }),

  pullFromSalesOrder: async (data: {
    sales_order_id: number;
    request_type?: string;
    content?: string;
    selected_item_ids?: number[];
  }): Promise<AfterSalesTicket> =>
    apiRequest('/apps/kuaizhizao/after-sales-tickets/pull-from-sales-order', { method: 'POST', data }),

  pullFromSalesDelivery: async (data: {
    sales_delivery_id: number;
    request_type?: string;
    content?: string;
    selected_item_ids?: number[];
  }): Promise<AfterSalesTicket> =>
    apiRequest('/apps/kuaizhizao/after-sales-tickets/pull-from-sales-delivery', {
      method: 'POST',
      data,
    }),

  previewPushToSalesReturn: async (id: number): Promise<AfterSalesTicketPushPreview> =>
    apiRequest(`/apps/kuaizhizao/after-sales-tickets/${id}/push-to-sales-return/preview`, {
      method: 'GET',
    }),

  pushToRepairOrder: async (
    id: number,
    data?: { fault_description?: string; service_asset_id?: number | null },
  ): Promise<{
    success: boolean;
    message: string;
    ticket_id: number;
    repair_order_id: number;
    repair_order_code: string;
  }> =>
    apiRequest(`/apps/kuaizhizao/after-sales-tickets/${id}/push-to-repair-order`, {
      method: 'POST',
      data: data ?? {},
    }),

  pushToSalesReturn: async (
    id: number,
    data: {
      warehouse_id: number;
      warehouse_name?: string;
      return_quantities?: Record<number, number>;
      batch_numbers?: Record<number, string>;
      return_code?: string;
    },
  ): Promise<{ success: boolean; message: string; return_id: number; return_code: string }> =>
    apiRequest(`/apps/kuaizhizao/after-sales-tickets/${id}/push-to-sales-return`, {
      method: 'POST',
      data,
    }),
};
