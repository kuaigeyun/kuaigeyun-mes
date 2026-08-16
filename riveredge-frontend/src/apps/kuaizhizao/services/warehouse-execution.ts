/**
 * 生产领料、成品入库、销售出库/退货、采购退货、补货、线边仓、倒冲、采购入库、客户来料等仓储执行 API
 */

import { apiRequest } from '../../../services/api';
import type { SalesReturnListParams, SalesReturnListResult } from './sales-return';

export type PurchaseReturnPullLine = {
  id: number;
  order_id: number;
  order_code?: string;
  supplier_id?: number;
  supplier_name?: string;
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

export type SalesReturnOrderPullLine = {
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

export type PurchaseReceiptOrderPullLine = {
  id: number;
  order_id: number;
  order_code?: string;
  supplier_id?: number;
  supplier_name?: string;
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

export type PurchaseReceiptNoticePullLine = {
  id: number;
  notice_id: number;
  notice_code?: string;
  purchase_order_id?: number;
  purchase_order_code?: string;
  supplier_id?: number;
  supplier_name?: string;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string | null;
  unit?: string;
  suggested_quantity?: number;
  pushed_quantity?: number;
  remaining_quantity?: number;
};

export type SalesDeliveryOrderPullLine = {
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

export type SalesDeliveryNoticePullLine = {
  id: number;
  notice_id: number;
  notice_code?: string;
  sales_order_id?: number;
  sales_order_code?: string;
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
};

export type WorkOrderFinishedGoodsPullLine = {
  id: number;
  work_order_id: number;
  work_order_code?: string;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string | null;
  unit?: string;
  suggested_quantity?: number;
  pushed_quantity?: number;
  remaining_quantity?: number;
};

export type ProductionReturnPullLine = {
  id: number;
  work_order_id: number;
  work_order_code?: string;
  picking_id?: number;
  picking_code?: string;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string | null;
  unit?: string;
  suggested_quantity?: number;
  pushed_quantity?: number;
  remaining_quantity?: number;
};

export type WorkOrderPickingPullLine = {
  id: number;
  work_order_id: number;
  work_order_code?: string;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string | null;
  unit?: string;
  suggested_quantity?: number;
  pushed_quantity?: number;
  remaining_quantity?: number;
};

export type OutsourceIssuePullLine = {
  id: number;
  outsource_work_order_id: number;
  outsource_work_order_code?: string;
  supplier_name?: string;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string | null;
  unit?: string;
  suggested_quantity?: number;
  pushed_quantity?: number;
  remaining_quantity?: number;
};

export type OutsourceInboundPullLine = {
  id: number;
  outsource_work_order_id: number;
  outsource_work_order_code?: string;
  supplier_name?: string;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string | null;
  unit?: string;
  suggested_quantity?: number;
  pushed_quantity?: number;
  remaining_quantity?: number;
  pull_type?: string;
};

type PullCreateResult = {
  success: boolean;
  message: string;
};

export type SalesReturnDeliveryPullLine = {
  id: number;
  sales_delivery_id: number;
  delivery_code?: string;
  sales_order_id?: number | null;
  sales_order_code?: string | null;
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

/** 销售出库确认前 OQC ensure 结果 */
export interface EnsureOqcForSalesDeliveryLineSummary {
  delivery_item_id: number;
  material_id: number;
  material_code: string;
  material_name: string;
  delivery_quantity: number;
  oqc_required: boolean;
  oqc_mode?: string | null;
  plan_label?: string | null;
  inspection_id?: number | null;
  inspection_code?: string | null;
  inspection_status?: string | null;
  quality_status?: string | null;
  review_status?: string | null;
  release_decision?: string | null;
  passed: boolean;
  can_outbound: boolean;
}

export interface EnsureOqcForSalesDeliveryResult {
  can_confirm_outbound: boolean;
  requires_oqc: boolean;
  gate_enabled: boolean;
  oqc_stage_enabled: boolean;
  created_count: number;
  created_inspections: unknown[];
  pending_inspections: unknown[];
  line_summaries: EnsureOqcForSalesDeliveryLineSummary[];
  message?: string | null;
}

export const warehouseApi = {
  productionPicking: {
    list: async (params?: any) => apiRequest('/apps/kuaizhizao/production-pickings', { method: 'GET', params }),
    create: async (data: any) => apiRequest('/apps/kuaizhizao/production-pickings', { method: 'POST', data }),
    update: async (id: string, data: any) => apiRequest(`/apps/kuaizhizao/production-pickings/${id}`, { method: 'PUT', data }),
    delete: async (id: string) => apiRequest(`/apps/kuaizhizao/production-pickings/${id}`, { method: 'DELETE' }),
    get: async (id: string) => apiRequest(`/apps/kuaizhizao/production-pickings/${id}`, { method: 'GET' }),
    confirm: async (id: string, data?: unknown) =>
      apiRequest(`/apps/kuaizhizao/production-pickings/${id}/confirm`, { method: 'POST', data: data ?? {} }),
    withdraw: async (id: string) =>
      apiRequest(`/apps/kuaizhizao/production-pickings/${id}/withdraw`, { method: 'POST' }),
    quickPick: async (workOrderId: string) =>
      apiRequest('/apps/kuaizhizao/production-pickings/quick-pick', { method: 'POST', params: { work_order_id: workOrderId } }),
    /** 批量领料：从多个工单下推创建生产领料单 */
    batchPick: async (params: { work_order_ids: number[]; warehouse_id?: number; warehouse_name?: string }) =>
      apiRequest('/apps/kuaizhizao/production-pickings/batch-pick', {
        method: 'POST',
        params: {
          work_order_ids: params.work_order_ids,
          warehouse_id: params.warehouse_id,
          warehouse_name: params.warehouse_name,
        },
      }),
    /** 工单加载创建生产领料单（单条、带明细） */
    pullFromWorkOrder: async (data: {
      work_order_id: number;
      warehouse_id?: number;
      warehouse_name?: string;
      picker_name?: string;
      notes?: string;
      lines: Array<{
        material_id: number;
        material_code: string;
        material_name: string;
        material_unit: string;
        issue_quantity: number;
        warehouse_id?: number;
        warehouse_name?: string;
        batch_number?: string;
        serial_numbers?: string[];
      }>;
    }) => apiRequest('/apps/kuaizhizao/production-pickings/pull-from-work-order', { method: 'POST', data }),
    /** 获取仓库主动备料提醒列表 */
    getMaterialPrepReminders: async (params?: { skip?: number; limit?: number }) =>
      apiRequest('/apps/kuaizhizao/production-pickings/material-prep-reminders', { method: 'GET', params }),
    listWorkOrderPullLines: async (params: {
      skip?: number;
      limit?: number;
      keyword?: string;
      work_order_id?: number;
      pullable_only?: boolean;
    }): Promise<{ data: WorkOrderPickingPullLine[]; total: number }> =>
      apiRequest('/apps/kuaizhizao/production-pickings/work-order-pull-lines', { method: 'GET', params }),
    pullFromWorkOrderItems: async (selectedItemIds: number[]): Promise<PullCreateResult> =>
      apiRequest('/apps/kuaizhizao/production-pickings/pull-from-work-order-items', {
        method: 'POST',
        data: { selected_item_ids: selectedItemIds },
      }),
  },
  productionReturn: {
    list: async (params?: any) => apiRequest('/apps/kuaizhizao/production-returns', { method: 'GET', params }),
    create: async (data: any) => apiRequest('/apps/kuaizhizao/production-returns', { method: 'POST', data }),
    update: async (id: string, data: any) => apiRequest(`/apps/kuaizhizao/production-returns/${id}`, { method: 'PUT', data }),
    delete: async (id: string) => apiRequest(`/apps/kuaizhizao/production-returns/${id}`, { method: 'DELETE' }),
    get: async (id: string) => apiRequest(`/apps/kuaizhizao/production-returns/${id}`, { method: 'GET' }),
    confirm: async (id: string, data?: any) => apiRequest(`/apps/kuaizhizao/production-returns/${id}/confirm`, { method: 'POST', data }),
    withdraw: async (id: string) =>
      apiRequest(`/apps/kuaizhizao/production-returns/${id}/withdraw`, { method: 'POST' }),
    previewFromWorkOrder: async (workOrderId: number) =>
      apiRequest('/apps/kuaizhizao/production-returns/work-order-preview', {
        method: 'GET',
        params: { work_order_id: workOrderId },
      }),
    listPickingItemPullLines: async (params: {
      skip?: number;
      limit?: number;
      keyword?: string;
      work_order_id?: number;
      pullable_only?: boolean;
    }): Promise<{ data: ProductionReturnPullLine[]; total: number }> =>
      apiRequest('/apps/kuaizhizao/production-returns/picking-item-pull-lines', { method: 'GET', params }),
    pullFromPickingItems: async (selectedItemIds: number[]): Promise<PullCreateResult> =>
      apiRequest('/apps/kuaizhizao/production-returns/pull-from-picking-items', {
        method: 'POST',
        data: { selected_item_ids: selectedItemIds },
      }),
  },
  materialCall: {
    list: async (params?: any) => apiRequest('/apps/kuaizhizao/material-calls', { method: 'GET', params }),
    create: async (data: any) => apiRequest('/apps/kuaizhizao/material-calls', { method: 'POST', data }),
    /** 整单叫料：按工单齐套缺料批量生成多条叫料 */
    batchFromWorkOrder: async (data: { work_order_id: number }) =>
      apiRequest('/apps/kuaizhizao/material-calls/batch-from-work-order', { method: 'POST', data }),
    update: async (id: number, data: any) => apiRequest(`/apps/kuaizhizao/material-calls/${id}`, { method: 'PATCH', data }),
    get: async (id: number) => apiRequest(`/apps/kuaizhizao/material-calls/${id}`, { method: 'GET' }),
    cancel: async (id: number) => apiRequest(`/apps/kuaizhizao/material-calls/${id}/cancel`, { method: 'POST' }),
  },
  otherInbound: {
    list: async (params?: any) => apiRequest('/apps/kuaizhizao/other-inbounds', { method: 'GET', params }),
    create: async (data: any) => apiRequest('/apps/kuaizhizao/other-inbounds', { method: 'POST', data }),
    update: async (id: string, data: any) => apiRequest(`/apps/kuaizhizao/other-inbounds/${id}`, { method: 'PUT', data }),
    delete: async (id: string) => apiRequest(`/apps/kuaizhizao/other-inbounds/${id}`, { method: 'DELETE' }),
    get: async (id: string) => apiRequest(`/apps/kuaizhizao/other-inbounds/${id}`, { method: 'GET' }),
    confirm: async (id: string, data?: any) => apiRequest(`/apps/kuaizhizao/other-inbounds/${id}/confirm`, { method: 'POST', data }),
    print: async (id: string, templateUuid?: string) =>
      apiRequest(`/apps/kuaizhizao/other-inbounds/${id}/print`, {
        method: 'GET',
        params: templateUuid ? { template_uuid: templateUuid } : undefined,
      }),
    withdraw: async (id: string) =>
      apiRequest(`/apps/kuaizhizao/other-inbounds/${id}/withdraw`, { method: 'POST' }),
    /** 软删且曾为已入库、库存未冲回时，按明细扣减即时库存（幂等，成功后状态变为已取消） */
    repairInventoryAfterDelete: async (id: string) =>
      apiRequest(`/apps/kuaizhizao/other-inbounds/${id}/repair-inventory`, { method: 'POST' }),
  },
  otherOutbound: {
    list: async (params?: any) => apiRequest('/apps/kuaizhizao/other-outbounds', { method: 'GET', params }),
    create: async (data: any) => apiRequest('/apps/kuaizhizao/other-outbounds', { method: 'POST', data }),
    update: async (id: string, data: any) => apiRequest(`/apps/kuaizhizao/other-outbounds/${id}`, { method: 'PUT', data }),
    delete: async (id: string) => apiRequest(`/apps/kuaizhizao/other-outbounds/${id}`, { method: 'DELETE' }),
    get: async (id: string) => apiRequest(`/apps/kuaizhizao/other-outbounds/${id}`, { method: 'GET' }),
    confirm: async (id: string, data?: unknown) =>
      apiRequest(`/apps/kuaizhizao/other-outbounds/${id}/confirm`, { method: 'POST', data: data ?? {} }),
    withdraw: async (id: string) =>
      apiRequest(`/apps/kuaizhizao/other-outbounds/${id}/withdraw`, { method: 'POST' }),
    print: async (id: string, templateUuid?: string) =>
      apiRequest(`/apps/kuaizhizao/other-outbounds/${id}/print`, {
        method: 'GET',
        params: templateUuid ? { template_uuid: templateUuid } : undefined,
      }),
  },
  materialBorrow: {
    list: async (params?: any) => apiRequest('/apps/kuaizhizao/material-borrows', { method: 'GET', params }),
    create: async (data: any) => apiRequest('/apps/kuaizhizao/material-borrows', { method: 'POST', data }),
    update: async (id: string, data: any) => apiRequest(`/apps/kuaizhizao/material-borrows/${id}`, { method: 'PUT', data }),
    delete: async (id: string) => apiRequest(`/apps/kuaizhizao/material-borrows/${id}`, { method: 'DELETE' }),
    get: async (id: string) => apiRequest(`/apps/kuaizhizao/material-borrows/${id}`, { method: 'GET' }),
    confirm: async (id: string, data?: unknown) =>
      apiRequest(`/apps/kuaizhizao/material-borrows/${id}/confirm`, { method: 'POST', data: data ?? {} }),
    withdraw: async (id: string) =>
      apiRequest(`/apps/kuaizhizao/material-borrows/${id}/withdraw`, { method: 'POST' }),
    print: async (id: string, templateUuid?: string) =>
      apiRequest(`/apps/kuaizhizao/material-borrows/${id}/print`, {
        method: 'GET',
        params: templateUuid ? { template_uuid: templateUuid } : undefined,
      }),
  },
  materialReturn: {
    list: async (params?: any) => apiRequest('/apps/kuaizhizao/material-returns', { method: 'GET', params }),
    create: async (data: any) => apiRequest('/apps/kuaizhizao/material-returns', { method: 'POST', data }),
    update: async (id: string, data: any) => apiRequest(`/apps/kuaizhizao/material-returns/${id}`, { method: 'PUT', data }),
    delete: async (id: string) => apiRequest(`/apps/kuaizhizao/material-returns/${id}`, { method: 'DELETE' }),
    get: async (id: string) => apiRequest(`/apps/kuaizhizao/material-returns/${id}`, { method: 'GET' }),
    confirm: async (id: string) => apiRequest(`/apps/kuaizhizao/material-returns/${id}/confirm`, { method: 'POST' }),
    print: async (id: string, templateUuid?: string) =>
      apiRequest(`/apps/kuaizhizao/material-returns/${id}/print`, {
        method: 'GET',
        params: templateUuid ? { template_uuid: templateUuid } : undefined,
      }),
  },
  finishedGoodsReceipt: {
    list: async (params?: any) => apiRequest('/apps/kuaizhizao/finished-goods-receipts', { method: 'GET', params }),
    create: async (data: any) => apiRequest('/apps/kuaizhizao/finished-goods-receipts', { method: 'POST', data }),
    update: async (id: string, data: any) => apiRequest(`/apps/kuaizhizao/finished-goods-receipts/${id}`, { method: 'PUT', data }),
    /** POST /delete：避免部分环境对 DELETE 返回 405 */
    delete: async (id: string) =>
      apiRequest(`/apps/kuaizhizao/finished-goods-receipts/${id}/delete`, { method: 'POST' }),
    get: async (id: string) => apiRequest(`/apps/kuaizhizao/finished-goods-receipts/${id}`, { method: 'GET' }),
    confirm: async (id: string, data?: any) => apiRequest(`/apps/kuaizhizao/finished-goods-receipts/${id}/confirm`, { method: 'POST', data }),
    withdraw: async (id: string) =>
      apiRequest(`/apps/kuaizhizao/finished-goods-receipts/${id}/withdraw`, { method: 'POST' }),
    /** 批量入库：从多个工单下推创建成品入库单 */
    batchReceipt: async (params: {
      work_order_ids: number[];
      warehouse_id?: number;
      warehouse_name?: string;
      receipt_code?: string;
      receipt_quantity?: number;
    }) =>
      apiRequest('/apps/kuaizhizao/finished-goods-receipts/batch-receipt', {
        method: 'POST',
        params: {
          work_order_ids: params.work_order_ids,
          warehouse_id: params.warehouse_id,
          warehouse_name: params.warehouse_name,
          receipt_code: params.receipt_code,
          receipt_quantity: params.receipt_quantity,
        },
      }),
    previewFromWorkOrder: async (workOrderId: number) =>
      apiRequest('/apps/kuaizhizao/finished-goods-receipts/work-order-preview', {
        method: 'GET',
        params: { work_order_id: workOrderId },
      }),
    listWorkOrderPullLines: async (params: {
      skip?: number;
      limit?: number;
      keyword?: string;
      work_order_id?: number;
      pullable_only?: boolean;
    }): Promise<{ data: WorkOrderFinishedGoodsPullLine[]; total: number }> =>
      apiRequest('/apps/kuaizhizao/finished-goods-receipts/work-order-pull-lines', { method: 'GET', params }),
    pullFromWorkOrders: async (selectedItemIds: number[]): Promise<PullCreateResult> =>
      apiRequest('/apps/kuaizhizao/finished-goods-receipts/pull-from-work-orders', {
        method: 'POST',
        data: { selected_item_ids: selectedItemIds },
      }),
  },
  semiFinishedGoodsReceipt: {
    list: async (params?: any) =>
      apiRequest('/apps/kuaizhizao/semi-finished-goods-receipts', { method: 'GET', params }),
    create: async (data: any) =>
      apiRequest('/apps/kuaizhizao/semi-finished-goods-receipts', { method: 'POST', data }),
    delete: async (id: string) =>
      apiRequest(`/apps/kuaizhizao/semi-finished-goods-receipts/${id}/delete`, { method: 'POST' }),
    get: async (id: string) =>
      apiRequest(`/apps/kuaizhizao/semi-finished-goods-receipts/${id}`, { method: 'GET' }),
    confirm: async (id: string, data?: any) =>
      apiRequest(`/apps/kuaizhizao/semi-finished-goods-receipts/${id}/confirm`, { method: 'POST', data }),
    withdraw: async (id: string) =>
      apiRequest(`/apps/kuaizhizao/semi-finished-goods-receipts/${id}/withdraw`, { method: 'POST' }),
  },
  salesDelivery: {
    list: async (params?: any) => apiRequest('/apps/kuaizhizao/sales-deliveries', { method: 'GET', params }),
    create: async (data: any) => apiRequest('/apps/kuaizhizao/sales-deliveries', { method: 'POST', data }),
    update: async (id: string, data: any) => apiRequest(`/apps/kuaizhizao/sales-deliveries/${id}`, { method: 'PUT', data }),
    delete: async (id: string) => apiRequest(`/apps/kuaizhizao/sales-deliveries/${id}`, { method: 'DELETE' }),
    get: async (id: string) => apiRequest(`/apps/kuaizhizao/sales-deliveries/${id}`, { method: 'GET' }),
    ensureOqc: async (id: string) =>
      apiRequest<EnsureOqcForSalesDeliveryResult>(
        `/apps/kuaizhizao/sales-deliveries/${id}/ensure-oqc`,
        { method: 'POST' },
      ),
    confirm: async (
      id: string,
      data?: { item_batches?: { item_id: number; batch_no: string }[] },
    ) => apiRequest(`/apps/kuaizhizao/sales-deliveries/${id}/confirm`, { method: 'POST', data: data ?? {} }),
    withdraw: async (id: string) => apiRequest(`/apps/kuaizhizao/sales-deliveries/${id}/withdraw`, { method: 'POST' }),
    import: async (data: any[][]) => apiRequest('/apps/kuaizhizao/sales-deliveries/import', { method: 'POST', data: { data } }),
    export: async (params?: any) =>
      apiRequest('/apps/kuaizhizao/sales-deliveries/export', { method: 'GET', params, responseType: 'blob' }),
    print: async (id: string, templateUuid?: string) =>
      apiRequest(`/apps/kuaizhizao/sales-deliveries/${id}/print`, {
        method: 'GET',
        params: templateUuid ? { template_uuid: templateUuid } : undefined,
      }),
    pullFromSalesOrder: async (data: {
      sales_order_id: number;
      delivery_quantities?: Record<number, number>;
      warehouse_id?: number;
      warehouse_name?: string;
      line_warehouses?: Record<number, number>;
    }) => apiRequest('/apps/kuaizhizao/sales-deliveries/pull-from-sales-order', { method: 'POST', data }),
    pullFromSalesForecast: async (data: {
      sales_forecast_id: number;
      delivery_quantities?: Record<number, number>;
      warehouse_id: number;
      warehouse_name?: string;
    }) => apiRequest('/apps/kuaizhizao/sales-deliveries/pull-from-sales-forecast', { method: 'POST', data }),
    listSalesOrderPullLines: async (params: {
      skip?: number;
      limit?: number;
      keyword?: string;
      sales_order_id?: number;
      pullable_only?: boolean;
    }): Promise<{ data: SalesDeliveryOrderPullLine[]; total: number }> =>
      apiRequest('/apps/kuaizhizao/sales-deliveries/sales-order-pull-lines', {
        method: 'GET',
        params,
      }),
    pullFromSalesOrderItems: async (
      selectedItemIds: number[],
    ): Promise<{
      success: boolean;
      message: string;
      delivery_id?: number;
      delivery_code?: string;
      deliveries?: Array<{ delivery_id: number; delivery_code: string }>;
    }> =>
      apiRequest('/apps/kuaizhizao/sales-deliveries/pull-from-sales-order-items', {
        method: 'POST',
        data: { selected_item_ids: selectedItemIds },
      }),
    listShipmentNoticePullLines: async (params: {
      skip?: number;
      limit?: number;
      keyword?: string;
      notice_id?: number;
      pullable_only?: boolean;
    }): Promise<{ data: SalesDeliveryNoticePullLine[]; total: number }> =>
      apiRequest('/apps/kuaizhizao/sales-deliveries/shipment-notice-pull-lines', {
        method: 'GET',
        params,
      }),
    pullFromShipmentNoticeItems: async (
      selectedItemIds: number[],
    ): Promise<{
      success: boolean;
      message: string;
      delivery_id?: number;
      delivery_code?: string;
      deliveries?: Array<{ delivery_id: number; delivery_code: string }>;
    }> =>
      apiRequest('/apps/kuaizhizao/sales-deliveries/pull-from-shipment-notice-items', {
        method: 'POST',
        data: { selected_item_ids: selectedItemIds },
      }),
  },
  wavePicking: {
    generate: async (data: { picking_ids: number[] }) =>
      apiRequest('/apps/kuaizhizao/wave-pickings/generate', { method: 'POST', data }),
  },
  salesReturn: {
    list: async (params?: SalesReturnListParams) =>
      apiRequest<SalesReturnListResult>('/apps/kuaizhizao/sales-returns', { method: 'GET', params }),
    create: async (data: any) => apiRequest('/apps/kuaizhizao/sales-returns', { method: 'POST', data }),
    delete: async (id: string) => apiRequest(`/apps/kuaizhizao/sales-returns/${id}`, { method: 'DELETE' }),
    get: async (id: string) => apiRequest(`/apps/kuaizhizao/sales-returns/${id}`, { method: 'GET' }),
    update: async (id: string, data: any) =>
      apiRequest(`/apps/kuaizhizao/sales-returns/${id}`, { method: 'PUT', data }),
    confirm: async (id: string, data?: any) => apiRequest(`/apps/kuaizhizao/sales-returns/${id}/confirm`, { method: 'POST', data }),
    withdraw: async (id: string) => apiRequest(`/apps/kuaizhizao/sales-returns/${id}/withdraw`, { method: 'POST' }),
    pullFromSalesOrder: async (data: {
      sales_order_id: number;
      warehouse_id: number;
      warehouse_name?: string;
      return_quantities?: Record<number, number>;
      batch_numbers?: Record<number, string>;
      return_code?: string;
    }) => apiRequest('/apps/kuaizhizao/sales-returns/pull-from-sales-order', { method: 'POST', data }),
    previewFromSalesOrder: async (salesOrderId: number) =>
      apiRequest('/apps/kuaizhizao/sales-returns/sales-order-preview', {
        method: 'GET',
        params: { sales_order_id: salesOrderId },
      }),
    pullFromSalesDelivery: async (data: {
      sales_delivery_id: number;
      warehouse_id: number;
      warehouse_name?: string;
      return_quantities?: Record<number, number>;
      return_code?: string;
    }) => apiRequest('/apps/kuaizhizao/sales-returns/pull-from-sales-delivery', { method: 'POST', data }),
    previewFromSalesDelivery: async (salesDeliveryId: number) =>
      apiRequest('/apps/kuaizhizao/sales-returns/sales-delivery-preview', {
        method: 'GET',
        params: { sales_delivery_id: salesDeliveryId },
      }),
    listCustomerOutboundBatches: async (params: { customer_id: number; material_id?: number }) =>
      apiRequest('/apps/kuaizhizao/sales-returns/customer-outbound-batches', {
        method: 'GET',
        params,
      }),
    listSalesOrderPullLines: async (params: {
      skip?: number;
      limit?: number;
      keyword?: string;
      sales_order_id?: number;
      pullable_only?: boolean;
    }): Promise<{ data: SalesReturnOrderPullLine[]; total: number }> =>
      apiRequest('/apps/kuaizhizao/sales-returns/sales-order-pull-lines', {
        method: 'GET',
        params,
      }),
    pullFromSalesOrderItems: async (
      selectedItemIds: number[],
    ): Promise<{
      success: boolean;
      message: string;
      return_id?: number;
      return_code?: string;
      returns?: Array<{ return_id: number; return_code: string }>;
    }> =>
      apiRequest('/apps/kuaizhizao/sales-returns/pull-from-sales-order-items', {
        method: 'POST',
        data: { selected_item_ids: selectedItemIds },
      }),
    listSalesDeliveryPullLines: async (params: {
      skip?: number;
      limit?: number;
      keyword?: string;
      sales_delivery_id?: number;
      pullable_only?: boolean;
    }): Promise<{ data: SalesReturnDeliveryPullLine[]; total: number }> =>
      apiRequest('/apps/kuaizhizao/sales-returns/sales-delivery-pull-lines', {
        method: 'GET',
        params,
      }),
    pullFromSalesDeliveryItems: async (
      selectedItemIds: number[],
    ): Promise<{
      success: boolean;
      message: string;
      return_id?: number;
      return_code?: string;
      returns?: Array<{ return_id: number; return_code: string }>;
    }> =>
      apiRequest('/apps/kuaizhizao/sales-returns/pull-from-sales-delivery-items', {
        method: 'POST',
        data: { selected_item_ids: selectedItemIds },
      }),
  },
  purchaseReturn: {
    list: async (params?: import('./purchase-return').PurchaseReturnListParams): Promise<import('./purchase-return').PurchaseReturnListResult> =>
      apiRequest('/apps/kuaizhizao/purchase-returns', { method: 'GET', params }),
    statistics: async () =>
      apiRequest<{
        total_count: number;
        pending_count: number;
        done_count: number;
        cancelled_count: number;
        trend_total: number[];
        trend_pending: number[];
        trend_done: number[];
        trend_cancelled: number[];
      }>('/apps/kuaizhizao/purchase-returns/statistics', { method: 'GET' }),
    create: async (data: any) => apiRequest('/apps/kuaizhizao/purchase-returns', { method: 'POST', data }),
    update: async (id: string, data: any) =>
      apiRequest(`/apps/kuaizhizao/purchase-returns/${id}`, { method: 'PUT', data }),
    delete: async (id: string) => apiRequest(`/apps/kuaizhizao/purchase-returns/${id}`, { method: 'DELETE' }),
    get: async (id: string) => apiRequest(`/apps/kuaizhizao/purchase-returns/${id}`, { method: 'GET' }),
    confirm: async (id: string) => apiRequest(`/apps/kuaizhizao/purchase-returns/${id}/confirm`, { method: 'POST' }),
    withdraw: async (id: string) => apiRequest(`/apps/kuaizhizao/purchase-returns/${id}/withdraw`, { method: 'POST' }),
    pullFromPurchaseOrder: async (data: {
      purchase_order_id: number;
      warehouse_id: number;
      warehouse_name?: string;
      return_quantities?: Record<number, number>;
    }) => apiRequest('/apps/kuaizhizao/purchase-returns/pull-from-purchase-order', { method: 'POST', data }),
    listPurchaseOrderPullLines: async (params: {
      skip?: number;
      limit?: number;
      keyword?: string;
      order_id?: number;
      pullable_only?: boolean;
    }): Promise<{ data: PurchaseReturnPullLine[]; total: number }> =>
      apiRequest('/apps/kuaizhizao/purchase-returns/purchase-order-pull-lines', {
        method: 'GET',
        params,
      }),
    pullFromPurchaseOrderItems: async (
      selectedItemIds: number[],
    ): Promise<{
      success: boolean;
      message: string;
      return_id?: number;
      return_code?: string;
      returns?: Array<{ return_id: number; return_code: string }>;
    }> =>
      apiRequest('/apps/kuaizhizao/purchase-returns/pull-from-purchase-order-items', {
        method: 'POST',
        data: { selected_item_ids: selectedItemIds },
      }),
  },
  replenishmentSuggestion: {
    list: async (params?: any) => apiRequest('/apps/kuaizhizao/replenishment-suggestions', { method: 'GET', params }),
    get: async (id: string) => apiRequest(`/apps/kuaizhizao/replenishment-suggestions/${id}`, { method: 'GET' }),
    generateFromAlerts: async (data?: { alert_ids?: number[] }) =>
      apiRequest<{
        items: any[];
        created: number;
        skipped_existing: number;
        skipped_zero_qty: number;
      }>('/apps/kuaizhizao/replenishment-suggestions/generate-from-alerts', { method: 'POST', data: data || {} }),
    generateFromDemandComputation: async (data: { demand_computation_id: number }) =>
      apiRequest<{
        items: any[];
        created: number;
        skipped_existing: number;
        skipped_zero_qty: number;
      }>('/apps/kuaizhizao/replenishment-suggestions/generate-from-demand-computation', {
        method: 'POST',
        data,
      }),
    previewPushToPurchaseRequisition: async (suggestion_ids: number[]) =>
      apiRequest('/apps/kuaizhizao/replenishment-suggestions/push-to-purchase-requisition/preview', {
        method: 'POST',
        data: { suggestion_ids },
      }),
    pushToPurchaseRequisition: async (suggestion_ids: number[]) =>
      apiRequest('/apps/kuaizhizao/replenishment-suggestions/push-to-purchase-requisition', {
        method: 'POST',
        data: { suggestion_ids },
      }),
    previewPushToPurchaseOrder: async (suggestion_ids: number[]) =>
      apiRequest('/apps/kuaizhizao/replenishment-suggestions/push-to-purchase-order/preview', {
        method: 'POST',
        data: { suggestion_ids },
      }),
    pushToPurchaseOrder: async (suggestion_ids: number[]) =>
      apiRequest('/apps/kuaizhizao/replenishment-suggestions/push-to-purchase-order', {
        method: 'POST',
        data: { suggestion_ids },
      }),
    process: async (id: string, data: { status: string; processing_notes?: string }) =>
      apiRequest(`/apps/kuaizhizao/replenishment-suggestions/${id}/process`, { method: 'POST', data }),
    statistics: async () => apiRequest('/apps/kuaizhizao/replenishment-suggestions/statistics', { method: 'GET' }),
  },
  lineSideWarehouse: {
    listWarehouses: async () => apiRequest('/apps/kuaizhizao/line-side-warehouse/warehouses', { method: 'GET' }),
    listInventory: async (params?: {
      warehouse_id?: number;
      material_code?: string;
      material_name?: string;
      skip?: number;
      limit?: number;
    }) => apiRequest<{ items: any[]; total: number }>('/apps/kuaizhizao/line-side-warehouse/inventory', { method: 'GET', params }),
  },
  backflushRecords: {
    list: async (params?: {
      work_order_code?: string;
      material_code?: string;
      status?: string;
      skip?: number;
      limit?: number;
    }) => apiRequest<{ items: any[]; total: number }>('/apps/kuaizhizao/backflush-records', { method: 'GET', params }),
    get: async (id: string) => apiRequest(`/apps/kuaizhizao/backflush-records/${id}`, { method: 'GET' }),
    retry: async (id: string) =>
      apiRequest<{ message: string; success: boolean }>(`/apps/kuaizhizao/backflush-records/${id}/retry`, { method: 'POST' }),
  },
  purchaseReceipt: {
    list: async (params?: any) => apiRequest('/apps/kuaizhizao/purchase-receipts', { method: 'GET', params }),
    create: async (data: any) => apiRequest('/apps/kuaizhizao/purchase-receipts', { method: 'POST', data }),
    pullFromReceiptNotice: async (data: { receipt_notice_id: number }) =>
      apiRequest('/apps/kuaizhizao/purchase-receipts/pull-from-receipt-notice', { method: 'POST', data }),
    listPurchaseOrderPullLines: async (params: {
      skip?: number;
      limit?: number;
      keyword?: string;
      order_id?: number;
      pullable_only?: boolean;
    }): Promise<{ data: PurchaseReceiptOrderPullLine[]; total: number }> =>
      apiRequest('/apps/kuaizhizao/purchase-receipts/purchase-order-pull-lines', {
        method: 'GET',
        params,
      }),
    pullFromPurchaseOrderItems: async (
      selectedItemIds: number[],
    ): Promise<{
      success: boolean;
      message: string;
      receipt_id?: number;
      receipt_code?: string;
      receipts?: Array<{ receipt_id: number; receipt_code: string }>;
    }> =>
      apiRequest('/apps/kuaizhizao/purchase-receipts/pull-from-purchase-order-items', {
        method: 'POST',
        data: { selected_item_ids: selectedItemIds },
      }),
    listReceiptNoticePullLines: async (params: {
      skip?: number;
      limit?: number;
      keyword?: string;
      notice_id?: number;
      pullable_only?: boolean;
    }): Promise<{ data: PurchaseReceiptNoticePullLine[]; total: number }> =>
      apiRequest('/apps/kuaizhizao/purchase-receipts/receipt-notice-pull-lines', {
        method: 'GET',
        params,
      }),
    pullFromReceiptNoticeItems: async (
      selectedItemIds: number[],
    ): Promise<{
      success: boolean;
      message: string;
      receipt_id?: number;
      receipt_code?: string;
      receipts?: Array<{ receipt_id: number; receipt_code: string }>;
    }> =>
      apiRequest('/apps/kuaizhizao/purchase-receipts/pull-from-receipt-notice-items', {
        method: 'POST',
        data: { selected_item_ids: selectedItemIds },
      }),
    update: async (id: string, data: any) => apiRequest(`/apps/kuaizhizao/purchase-receipts/${id}`, { method: 'PUT', data }),
    /** POST /delete：避免部分环境对 DELETE 返回 405 */
    delete: async (id: string) =>
      apiRequest(`/apps/kuaizhizao/purchase-receipts/${id}/delete`, { method: 'POST' }),
    get: async (id: string) => apiRequest(`/apps/kuaizhizao/purchase-receipts/${id}`, { method: 'GET' }),
    confirm: async (id: string, data?: any) => apiRequest(`/apps/kuaizhizao/purchase-receipts/${id}/confirm`, { method: 'POST', data }),
    withdraw: async (id: string) => apiRequest(`/apps/kuaizhizao/purchase-receipts/${id}/withdraw`, { method: 'POST' }),
    import: async (data: any[][]) =>
      apiRequest('/apps/kuaizhizao/purchase-receipts/import', { method: 'POST', data: { data } }),
    export: async (params?: any) =>
      apiRequest('/apps/kuaizhizao/purchase-receipts/export', { method: 'GET', params, responseType: 'blob' }),
  },
  customerMaterialRegistration: {
    parseBarcode: async (data: { barcode: string; barcode_type?: string; customer_id?: number }) =>
      apiRequest('/apps/kuaizhizao/inventory/customer-material-registration/parse-barcode', { method: 'POST', data }),
    list: async (params?: {
      skip?: number;
      limit?: number;
      customer_id?: number;
      status?: string;
      registration_date_start?: string;
      registration_date_end?: string;
    }) =>
      apiRequest('/apps/kuaizhizao/inventory/customer-material-registration', { method: 'GET', params }),
    create: async (data: any) =>
      apiRequest('/apps/kuaizhizao/inventory/customer-material-registration', { method: 'POST', data }),
    get: async (id: string) =>
      apiRequest(`/apps/kuaizhizao/inventory/customer-material-registration/${id}`, { method: 'GET' }),
  },
  barcodeMappingRule: {
    list: async (params?: { skip?: number; limit?: number; customer_id?: number; is_enabled?: boolean }) =>
      apiRequest('/apps/kuaizhizao/inventory/customer-material-registration/mapping-rules', { method: 'GET', params }),
    create: async (data: any) =>
      apiRequest('/apps/kuaizhizao/inventory/customer-material-registration/mapping-rules', { method: 'POST', data }),
    get: async (id: string) =>
      apiRequest(`/apps/kuaizhizao/inventory/customer-material-registration/mapping-rules/${id}`, { method: 'GET' }),
    update: async (id: string, data: any) =>
      apiRequest(`/apps/kuaizhizao/inventory/customer-material-registration/mapping-rules/${id}`, { method: 'PUT', data }),
    delete: async (id: string) =>
      apiRequest(`/apps/kuaizhizao/inventory/customer-material-registration/mapping-rules/${id}`, { method: 'DELETE' }),
  },
  outsourceIssue: {
    listWorkOrderPullLines: async (params: {
      skip?: number;
      limit?: number;
      keyword?: string;
      outsource_work_order_id?: number;
      pullable_only?: boolean;
    }): Promise<{ data: OutsourceIssuePullLine[]; total: number }> =>
      apiRequest('/apps/kuaizhizao/outsource-issues/work-order-pull-lines', { method: 'GET', params }),
    pullFromWorkOrderItems: async (selectedItemIds: number[]): Promise<PullCreateResult> =>
      apiRequest('/apps/kuaizhizao/outsource-issues/pull-from-work-order-items', {
        method: 'POST',
        data: { selected_item_ids: selectedItemIds },
      }),
  },
  outsourceInbound: {
    listPullLines: async (params: {
      pull_type: string;
      skip?: number;
      limit?: number;
      keyword?: string;
      outsource_work_order_id?: number;
      pullable_only?: boolean;
    }): Promise<{ data: OutsourceInboundPullLine[]; total: number }> =>
      apiRequest('/apps/kuaizhizao/outsource-inbound/pull-lines', { method: 'GET', params }),
    pullFromItems: async (selectedItemIds: number[], pullType: string): Promise<PullCreateResult> =>
      apiRequest('/apps/kuaizhizao/outsource-inbound/pull-from-items', {
        method: 'POST',
        data: { selected_item_ids: selectedItemIds, pull_type: pullType },
      }),
  },
};
