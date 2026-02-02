import { apiRequest } from '../../../../services/api';
import { Invoice, InvoiceListParams, InvoiceCreateData, InvoiceUpdateData } from '../../types/finance/invoice';

const INVOICE_API = '/apps/kuaizhizao/invoices'; // Correct API path based on other services

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
