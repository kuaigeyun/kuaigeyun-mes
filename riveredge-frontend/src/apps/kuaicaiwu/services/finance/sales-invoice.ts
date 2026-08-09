import { apiRequest } from '../../../../services/api';
import type { DocumentPushPreview } from '../../../kuaizhizao/services/purchase-requisition';
import type { SalesInvoice, SalesInvoiceListParams } from '../../types/finance/sales-invoice';

export type { SalesInvoice, SalesInvoiceListParams };

export type SalesInvoicePullPreview = DocumentPushPreview & {
  source_type?: 'sales_order' | 'sales_delivery' | 'receivable';
  customer_id?: number;
  customer_name?: string;
  sales_order_id?: number | null;
  sales_order_code?: string | null;
  receivable_id?: number;
  receivable_code?: string;
  price_type?: 'tax_inclusive' | 'tax_exclusive' | string;
};

export type SalesInvoicePullCandidate = {
  id: number;
  code: string;
  order_code?: string;
  delivery_code?: string;
  customer_name?: string;
  source_status?: string;
  source_date?: string;
  amount?: number;
  capabilities?: { pull_sales_invoice?: { allowed?: boolean; reason?: string } };
};

export const salesInvoiceService = {
  list: (params: SalesInvoiceListParams) =>
    apiRequest<{ items: SalesInvoice[]; total: number }>('/apps/kuaicaiwu/sales-invoices', {
      method: 'GET',
      params,
    }),

  listSalesOrderPullCandidates: async (params?: { skip?: number; limit?: number; keyword?: string }) =>
    apiRequest<{ data: SalesInvoicePullCandidate[]; total: number; success: boolean }>(
      '/apps/kuaicaiwu/sales-invoices/pull-candidates/sales-orders',
      { method: 'GET', params },
    ),
  listSalesDeliveryPullCandidates: async (params?: { skip?: number; limit?: number; keyword?: string }) =>
    apiRequest<{ data: SalesInvoicePullCandidate[]; total: number; success: boolean }>(
      '/apps/kuaicaiwu/sales-invoices/pull-candidates/sales-deliveries',
      { method: 'GET', params },
    ),
  previewPullFromSalesOrder: async (orderId: number) =>
    apiRequest<SalesInvoicePullPreview>(`/apps/kuaicaiwu/sales-invoices/from-sales-order/${orderId}/pull-preview`, {
      method: 'GET',
    }),
  previewPullFromSalesDelivery: async (deliveryId: number) =>
    apiRequest<SalesInvoicePullPreview>(
      `/apps/kuaicaiwu/sales-invoices/from-sales-delivery/${deliveryId}/pull-preview`,
      { method: 'GET' },
    ),
  listReceivablePullCandidates: async (params?: { skip?: number; limit?: number; keyword?: string }) =>
    apiRequest<{ data: SalesInvoicePullCandidate[]; total: number; success: boolean }>(
      '/apps/kuaicaiwu/sales-invoices/pull-candidates/receivables',
      { method: 'GET', params },
    ),
  previewPullFromReceivable: async (receivableId: number) =>
    apiRequest<SalesInvoicePullPreview>(
      `/apps/kuaicaiwu/sales-invoices/from-receivable/${receivableId}/pull-preview`,
      { method: 'GET' },
    ),
};
