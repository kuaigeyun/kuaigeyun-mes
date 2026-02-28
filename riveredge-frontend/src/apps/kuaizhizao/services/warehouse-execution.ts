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
    confirm: async (id: string) => apiRequest(`/apps/kuaizhizao/production-pickings/${id}/confirm`, { method: 'POST' }),
    quickPick: async (workOrderId: string) =>
      apiRequest('/apps/kuaizhizao/production-pickings/quick-pick', { method: 'POST', params: { work_order_id: workOrderId } }),
  },
  productionReturn: {
    list: async (params?: any) => apiRequest('/apps/kuaizhizao/production-returns', { method: 'GET', params }),
    create: async (data: any) => apiRequest('/apps/kuaizhizao/production-returns', { method: 'POST', data }),
    update: async (id: string, data: any) => apiRequest(`/apps/kuaizhizao/production-returns/${id}`, { method: 'PUT', data }),
    delete: async (id: string) => apiRequest(`/apps/kuaizhizao/production-returns/${id}`, { method: 'DELETE' }),
    get: async (id: string) => apiRequest(`/apps/kuaizhizao/production-returns/${id}`, { method: 'GET' }),
    confirm: async (id: string) => apiRequest(`/apps/kuaizhizao/production-returns/${id}/confirm`, { method: 'POST' }),
    print: async (id: string, templateUuid?: string) =>
      apiRequest(`/apps/kuaizhizao/production-returns/${id}/print`, {
        method: 'GET',
        params: templateUuid ? { template_uuid: templateUuid } : undefined,
      }),
  },
  otherInbound: {
    list: async (params?: any) => apiRequest('/apps/kuaizhizao/other-inbounds', { method: 'GET', params }),
    create: async (data: any) => apiRequest('/apps/kuaizhizao/other-inbounds', { method: 'POST', data }),
    update: async (id: string, data: any) => apiRequest(`/apps/kuaizhizao/other-inbounds/${id}`, { method: 'PUT', data }),
    delete: async (id: string) => apiRequest(`/apps/kuaizhizao/other-inbounds/${id}`, { method: 'DELETE' }),
    get: async (id: string) => apiRequest(`/apps/kuaizhizao/other-inbounds/${id}`, { method: 'GET' }),
    confirm: async (id: string) => apiRequest(`/apps/kuaizhizao/other-inbounds/${id}/confirm`, { method: 'POST' }),
    print: async (id: string, templateUuid?: string) =>
      apiRequest(`/apps/kuaizhizao/other-inbounds/${id}/print`, {
        method: 'GET',
        params: templateUuid ? { template_uuid: templateUuid } : undefined,
      }),
  },
  otherOutbound: {
    list: async (params?: any) => apiRequest('/apps/kuaizhizao/other-outbounds', { method: 'GET', params }),
    create: async (data: any) => apiRequest('/apps/kuaizhizao/other-outbounds', { method: 'POST', data }),
    update: async (id: string, data: any) => apiRequest(`/apps/kuaizhizao/other-outbounds/${id}`, { method: 'PUT', data }),
    delete: async (id: string) => apiRequest(`/apps/kuaizhizao/other-outbounds/${id}`, { method: 'DELETE' }),
    get: async (id: string) => apiRequest(`/apps/kuaizhizao/other-outbounds/${id}`, { method: 'GET' }),
    confirm: async (id: string) => apiRequest(`/apps/kuaizhizao/other-outbounds/${id}/confirm`, { method: 'POST' }),
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
    confirm: async (id: string) => apiRequest(`/apps/kuaizhizao/material-borrows/${id}/confirm`, { method: 'POST' }),
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
    delete: async (id: string) => apiRequest(`/apps/kuaizhizao/finished-goods-receipts/${id}`, { method: 'DELETE' }),
    get: async (id: string) => apiRequest(`/apps/kuaizhizao/finished-goods-receipts/${id}`, { method: 'GET' }),
    confirm: async (id: string) => apiRequest(`/apps/kuaizhizao/finished-goods-receipts/${id}/confirm`, { method: 'POST' }),
  },
  salesDelivery: {
    list: async (params?: any) => apiRequest('/apps/kuaizhizao/sales-deliveries', { method: 'GET', params }),
    create: async (data: any) => apiRequest('/apps/kuaizhizao/sales-deliveries', { method: 'POST', data }),
    update: async (id: string, data: any) => apiRequest(`/apps/kuaizhizao/sales-deliveries/${id}`, { method: 'PUT', data }),
    delete: async (id: string) => apiRequest(`/apps/kuaizhizao/sales-deliveries/${id}`, { method: 'DELETE' }),
    get: async (id: string) => apiRequest(`/apps/kuaizhizao/sales-deliveries/${id}`, { method: 'GET' }),
    confirm: async (id: string) => apiRequest(`/apps/kuaizhizao/sales-deliveries/${id}/confirm`, { method: 'POST' }),
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
  salesReturn: {
    list: async (params?: any) => apiRequest('/apps/kuaizhizao/sales-returns', { method: 'GET', params }),
    create: async (data: any) => apiRequest('/apps/kuaizhizao/sales-returns', { method: 'POST', data }),
    delete: async (id: string) => apiRequest(`/apps/kuaizhizao/sales-returns/${id}`, { method: 'DELETE' }),
    get: async (id: string) => apiRequest(`/apps/kuaizhizao/sales-returns/${id}`, { method: 'GET' }),
    confirm: async (id: string) => apiRequest(`/apps/kuaizhizao/sales-returns/${id}/confirm`, { method: 'POST' }),
  },
  purchaseReturn: {
    list: async (params?: any) => apiRequest('/apps/kuaizhizao/purchase-returns', { method: 'GET', params }),
    create: async (data: any) => apiRequest('/apps/kuaizhizao/purchase-returns', { method: 'POST', data }),
    delete: async (id: string) => apiRequest(`/apps/kuaizhizao/purchase-returns/${id}`, { method: 'DELETE' }),
    get: async (id: string) => apiRequest(`/apps/kuaizhizao/purchase-returns/${id}`, { method: 'GET' }),
    confirm: async (id: string) => apiRequest(`/apps/kuaizhizao/purchase-returns/${id}/confirm`, { method: 'POST' }),
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
    update: async (id: string, data: any) => apiRequest(`/apps/kuaizhizao/purchase-receipts/${id}`, { method: 'PUT', data }),
    delete: async (id: string) => apiRequest(`/apps/kuaizhizao/purchase-receipts/${id}`, { method: 'DELETE' }),
    get: async (id: string) => apiRequest(`/apps/kuaizhizao/purchase-receipts/${id}`, { method: 'GET' }),
    confirm: async (id: string) => apiRequest(`/apps/kuaizhizao/purchase-receipts/${id}/confirm`, { method: 'POST' }),
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
