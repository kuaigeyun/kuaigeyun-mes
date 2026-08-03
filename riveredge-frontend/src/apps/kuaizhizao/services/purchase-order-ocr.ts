import { apiRequest, API_BASE_URL } from '../../../services/api';
import { getToken } from '../../../utils/auth';

export interface PurchaseOrderOcrItem {
  materialCode?: string | null;
  materialName?: string | null;
  materialSpec?: string | null;
  materialUnit?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  taxRate?: number | null;
  deliveryDate?: string | null;
  notes?: string | null;
}

export interface PurchaseOrderOcrResult {
  supplierName?: string | null;
  supplierContact?: string | null;
  supplierPhone?: string | null;
  orderDate?: string | null;
  deliveryDate?: string | null;
  paymentTerms?: string | null;
  currencyCode?: string | null;
  notes?: string | null;
  items: PurchaseOrderOcrItem[];
  confidenceNotes?: string | null;
}

const BASE = '/apps/kuaizhizao/purchase-orders';

export async function parsePurchaseOrderFromText(
  text: string,
  context?: PurchaseOrderOcrResult,
): Promise<PurchaseOrderOcrResult> {
  return apiRequest(`${BASE}/ocr-parse-text`, {
    method: 'POST',
    body: JSON.stringify({ text, context }),
  });
}

export async function extractPurchaseOrderFromImage(file: File): Promise<PurchaseOrderOcrResult> {
  const form = new FormData();
  form.append('file', file);
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const tenantId = localStorage.getItem('tenant_id');
  if (tenantId?.trim()) headers['X-Tenant-ID'] = tenantId.trim();
  const res = await fetch(`${API_BASE_URL}${BASE}/ocr-extract`, {
    method: 'POST',
    headers,
    body: form,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.detail?.message || data?.detail || 'OCR 识别失败');
  }
  return res.json();
}
