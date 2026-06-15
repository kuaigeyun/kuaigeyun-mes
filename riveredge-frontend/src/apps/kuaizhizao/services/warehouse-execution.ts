/**
 * 生产领料、成品入库、销售出库/退货、采购退货、补货、线边仓、倒冲、采购入库、客户来料等仓储执行 API
 */

import { apiRequest } from '../../../services/api';

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
    /** 获取仓库主动备料提醒列表 */
    getMaterialPrepReminders: async (params?: { skip?: number; limit?: number }) =>
      apiRequest('/apps/kuaizhizao/production-pickings/material-prep-reminders', { method: 'GET', params }),
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
    print: async (id: string, templateUuid?: string) =>
      apiRequest(`/apps/kuaizhizao/production-returns/${id}/print`, {
        method: 'GET',
        params: templateUuid ? { template_uuid: templateUuid } : undefined,
      }),
  },
  materialCall: {
    list: async (params?: any) => apiRequest('/apps/kuaizhizao/material-calls', { method: 'GET', params }),
    create: async (data: any) => apiRequest('/apps/kuaizhizao/material-calls', { method: 'POST', data }),
    /** 整单叫料：按工单齐套缺料批量生成多条叫料 */
    batchFromWorkOrder: async (data: { work_order_id: number }) =>
      apiRequest('/apps/kuaizhizao/material-calls/batch-from-work-order', { method: 'POST', data }),
    update: async (id: number, data: any) => apiRequest(`/apps/kuaizhizao/material-calls/${id}`, { method: 'PATCH', data }),
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
      warehouse_id: number;
      warehouse_name?: string;
    }) => apiRequest('/apps/kuaizhizao/sales-deliveries/pull-from-sales-order', { method: 'POST', data }),
    pullFromSalesForecast: async (data: {
      sales_forecast_id: number;
      delivery_quantities?: Record<number, number>;
      warehouse_id: number;
      warehouse_name?: string;
    }) => apiRequest('/apps/kuaizhizao/sales-deliveries/pull-from-sales-forecast', { method: 'POST', data }),
  },
  wavePicking: {
    generate: async (data: { picking_ids: number[] }) =>
      apiRequest('/apps/kuaizhizao/wave-pickings/generate', { method: 'POST', data }),
  },
  salesReturn: {
    list: async (params?: any) => apiRequest('/apps/kuaizhizao/sales-returns', { method: 'GET', params }),
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
      return_code?: string;
    }) => apiRequest('/apps/kuaizhizao/sales-returns/pull-from-sales-order', { method: 'POST', data }),
    previewFromSalesOrder: async (salesOrderId: number) =>
      apiRequest('/apps/kuaizhizao/sales-returns/sales-order-preview', {
        method: 'GET',
        params: { sales_order_id: salesOrderId },
      }),
  },
  purchaseReturn: {
    list: async (params?: any) => apiRequest('/apps/kuaizhizao/purchase-returns', { method: 'GET', params }),
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
  },
  replenishmentSuggestion: {
    list: async (params?: any) => apiRequest('/apps/kuaizhizao/replenishment-suggestions', { method: 'GET', params }),
    get: async (id: string) => apiRequest(`/apps/kuaizhizao/replenishment-suggestions/${id}`, { method: 'GET' }),
    generateFromAlerts: async (data?: { alert_ids?: number[] }) =>
      apiRequest('/apps/kuaizhizao/replenishment-suggestions/generate-from-alerts', { method: 'POST', data: data || {} }),
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
};
