import { apiRequest } from '../../../../services/api';
import type { DocumentPushPreview } from '../../../kuaizhizao/services/purchase-requisition';
import {
  PurchaseInvoice,
  PurchaseInvoiceListParams,
  PurchaseInvoiceCreateData,
} from '../../types/finance/purchase-invoice';

const PURCHASE_INVOICE_API = '/apps/kuaicaiwu/purchase-invoices';

export type PurchaseInvoicePullPreview = DocumentPushPreview & {
  source_type?: 'purchase_order' | 'purchase_receipt' | 'payable';
  supplier_id?: number;
  supplier_name?: string;
  purchase_order_id?: number | null;
  purchase_order_code?: string | null;
  payable_id?: number;
  payable_code?: string;
};

export type PurchaseInvoicePullCandidate = {
  id: number;
  code: string;
  order_code?: string;
  receipt_code?: string;
  supplier_name?: string;
  source_status?: string;
  source_date?: string;
  amount?: number;
  capabilities?: { pull_purchase_invoice?: { allowed?: boolean; reason?: string } };
};

export const purchaseInvoiceService = {
  create: (data: PurchaseInvoiceCreateData) => {
    return apiRequest<PurchaseInvoice>(PURCHASE_INVOICE_API, {
      method: 'POST',
      data,
    });
  },

  list: (params: PurchaseInvoiceListParams) => {
    return apiRequest<{ items: PurchaseInvoice[]; total: number }>(PURCHASE_INVOICE_API, {
      method: 'GET',
      params,
    });
  },

  get: (id: number) => {
    return apiRequest<PurchaseInvoice>(`${PURCHASE_INVOICE_API}/${id}`, {
      method: 'GET',
    });
  },

  approve: (id: number, rejection_reason?: string) => {
    return apiRequest<PurchaseInvoice>(`${PURCHASE_INVOICE_API}/${id}/approve`, {
      method: 'POST',
      params: { rejection_reason },
    });
  },

  listPurchaseOrderPullCandidates: async (params?: { skip?: number; limit?: number; keyword?: string }) =>
    apiRequest<{ data: PurchaseInvoicePullCandidate[]; total: number; success: boolean }>(
      `${PURCHASE_INVOICE_API}/pull-candidates/purchase-orders`,
      { method: 'GET', params },
    ),

  listPurchaseReceiptPullCandidates: async (params?: { skip?: number; limit?: number; keyword?: string }) =>
    apiRequest<{ data: PurchaseInvoicePullCandidate[]; total: number; success: boolean }>(
      `${PURCHASE_INVOICE_API}/pull-candidates/purchase-receipts`,
      { method: 'GET', params },
    ),

  previewPullFromPurchaseOrder: async (orderId: number) =>
    apiRequest<PurchaseInvoicePullPreview>(
      `${PURCHASE_INVOICE_API}/from-purchase-order/${orderId}/pull-preview`,
      { method: 'GET' },
    ),

  previewPullFromPurchaseReceipt: async (receiptId: number) =>
    apiRequest<PurchaseInvoicePullPreview>(
      `${PURCHASE_INVOICE_API}/from-purchase-receipt/${receiptId}/pull-preview`,
      { method: 'GET' },
    ),

  listPayablePullCandidates: async (params?: { skip?: number; limit?: number; keyword?: string }) =>
    apiRequest<{ data: PurchaseInvoicePullCandidate[]; total: number; success: boolean }>(
      `${PURCHASE_INVOICE_API}/pull-candidates/payables`,
      { method: 'GET', params },
    ),

  previewPullFromPayable: async (payableId: number) =>
    apiRequest<PurchaseInvoicePullPreview>(
      `${PURCHASE_INVOICE_API}/from-payable/${payableId}/pull-preview`,
      { method: 'GET' },
    ),
};
