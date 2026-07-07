import { apiRequest } from '../../../../services/api';
import type { DocumentPushPreview } from '../../../kuaizhizao/services/purchase-requisition';

export type SalesInvoicePullPreview = DocumentPushPreview & {
  source_type?: 'sales_order' | 'sales_delivery';
  customer_id?: number;
  customer_name?: string;
  sales_order_id?: number | null;
  sales_order_code?: string | null;
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
};
