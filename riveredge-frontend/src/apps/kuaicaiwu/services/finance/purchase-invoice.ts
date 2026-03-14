import { apiRequest } from '../../../../services/api';
import {
  PurchaseInvoice,
  PurchaseInvoiceListParams,
  PurchaseInvoiceCreateData,
} from '../../types/finance/purchase-invoice';

const PURCHASE_INVOICE_API = '/apps/kuaicaiwu/purchase-invoices';

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
};
