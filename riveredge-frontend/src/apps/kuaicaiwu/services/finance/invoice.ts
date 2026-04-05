import { apiRequest } from '../../../../services/api';
import {
  Invoice,
  InvoiceListParams,
  InvoiceCreateData,
  InvoiceUpdateData,
} from '../../types/finance/invoice';

const INVOICE_API = '/apps/kuaicaiwu/invoices';

export interface InvoiceStatistics {
  total_count: number;
  in_total_amount: number;
  out_total_amount: number;
  pending_verification_count: number;
}

export const invoiceService = {
  createInvoice: (data: InvoiceCreateData) => {
    return apiRequest<Invoice>(INVOICE_API, {
      method: 'POST',
      data,
    });
  },

  listInvoices: (params: InvoiceListParams) => {
    return apiRequest<{ items: Invoice[]; total: number }>(INVOICE_API, {
      method: 'GET',
      params,
    });
  },

  getStatistics: () =>
    apiRequest<InvoiceStatistics>(`${INVOICE_API}/statistics`, {
      method: 'GET',
    }),

  getInvoice: (code: string) => {
    return apiRequest<Invoice>(`${INVOICE_API}/${code}`, {
      method: 'GET',
    });
  },

  updateInvoice: (code: string, data: InvoiceUpdateData) => {
    return apiRequest<Invoice>(`${INVOICE_API}/${code}`, {
      method: 'PUT',
      data,
    });
  },

  deleteInvoice: (code: string) => {
    return apiRequest<void>(`${INVOICE_API}/${code}`, {
      method: 'DELETE',
    });
  },
};
