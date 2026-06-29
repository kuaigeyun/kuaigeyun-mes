/**
 * 销售订单 OCR 智能录单 API
 */

import { apiRequest } from '../../../services/api';

export interface SalesOrderOcrItem {
  materialCode?: string | null;
  materialName?: string | null;
  materialSpec?: string | null;
  materialUnit?: string | null;
  requiredQuantity?: number | null;
  unitPrice?: number | null;
  taxRate?: number | null;
  deliveryDate?: string | null;
  notes?: string | null;
}

export interface SalesOrderOcrResult {
  customerName?: string | null;
  customerContact?: string | null;
  customerPhone?: string | null;
  shippingAddress?: string | null;
  orderDate?: string | null;
  deliveryDate?: string | null;
  shippingMethod?: string | null;
  paymentTerms?: string | null;
  currencyCode?: string | null;
  notes?: string | null;
  confidenceNotes?: string | null;
  items: SalesOrderOcrItem[];
}

export async function extractSalesOrderFromImage(file: File): Promise<SalesOrderOcrResult> {
  const formData = new FormData();
  formData.append('file', file);
  return apiRequest<SalesOrderOcrResult>('/apps/kuaizhizao/sales-orders/ocr-extract', {
    method: 'POST',
    body: formData,
  });
}

export async function parseSalesOrderFromText(
  text: string,
  context?: SalesOrderOcrResult | null,
): Promise<SalesOrderOcrResult> {
  return apiRequest<SalesOrderOcrResult>('/apps/kuaizhizao/sales-orders/ocr-parse-text', {
    method: 'POST',
    body: JSON.stringify({
      text,
      context: context ?? undefined,
    }),
  });
}
