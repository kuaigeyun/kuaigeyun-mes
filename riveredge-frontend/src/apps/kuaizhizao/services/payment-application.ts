import { apiRequest } from '../../../services/api';

export interface PaymentApplicationLine {
  id?: number;
  lineNo?: number;
  sourceType: string;
  sourceId?: number;
  sourceCode?: string;
  payableId?: number;
  payableCode?: string;
  lineKind?: string;
  requestAmount: number;
  paidAmount?: number;
  maxRequestAmount?: number;
  notes?: string;
}

export interface PaymentApplication {
  id: number;
  uuid: string;
  applicationCode: string;
  supplierId: number;
  supplierName: string;
  applicationKind: string;
  applicationDate?: string;
  expectedPaymentDate?: string;
  applicantId?: number;
  applicantName?: string;
  totalRequestAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
  reviewStatus: string;
  reviewerName?: string;
  reviewTime?: string;
  reviewRemarks?: string;
  supplierAccountName?: string;
  supplierBankName?: string;
  supplierBankAccount?: string;
  paymentReason?: string;
  paymentMethod?: string;
  invoiceStatus?: string;
  paymentTerms?: string;
  notes?: string;
  /** 勾选后，由该申请下推/取单生成的付款单必须上传付款凭证 */
  requirePaymentVoucher?: boolean;
  attachments?: Array<Record<string, unknown>>;
  items: PaymentApplicationLine[];
  linkedPayments?: Array<{ id: number; code: string }>;
  capabilities?: Record<string, { allowed: boolean; reason?: string }>;
  audit?: {
    phase?: string;
    enabled?: boolean;
    mode?: string;
    allowed_actions?: string[];
    entity_type?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

const BASE = '/apps/kuaizhizao/payment-applications';

export async function listPaymentApplications(params: Record<string, unknown>) {
  return apiRequest<{ data: PaymentApplication[]; total: number }>(BASE, {
    method: 'GET',
    params,
  });
}

export async function getPaymentApplication(id: number) {
  return apiRequest<PaymentApplication>(`${BASE}/${id}`, { method: 'GET' });
}

export async function createPaymentApplication(payload: Record<string, unknown>) {
  return apiRequest<PaymentApplication>(BASE, { method: 'POST', data: payload });
}

export async function updatePaymentApplication(id: number, payload: Record<string, unknown>) {
  return apiRequest<PaymentApplication>(`${BASE}/${id}`, { method: 'PUT', data: payload });
}

export async function deletePaymentApplication(id: number) {
  return apiRequest<void>(`${BASE}/${id}`, { method: 'DELETE' });
}

export async function submitPaymentApplication(id: number) {
  return apiRequest<PaymentApplication>(`${BASE}/${id}/submit`, { method: 'POST' });
}

export async function approvePaymentApplication(
  id: number,
  payload: { approved: boolean; reviewRemarks?: string },
) {
  return apiRequest<PaymentApplication>(`${BASE}/${id}/approve`, { method: 'POST', data: payload });
}

export async function pushPaymentApplicationToPayment(
  id: number,
  payload: Record<string, unknown>,
) {
  return apiRequest<Record<string, unknown>>(`${BASE}/${id}/push-payment`, {
    method: 'POST',
    data: payload,
  });
}

export async function listPayablesForPaymentApplication(
  supplierId: number,
  params?: Record<string, unknown>,
) {
  return apiRequest<{ data: Array<Record<string, unknown>>; total: number }>(
    `${BASE}/pull/payables`,
    { method: 'GET', params: { supplier_id: supplierId, ...params } },
  );
}

export async function pullPaymentApplicationFromReconciliation(payload: {
  supplierId: number;
  items: Array<{ doc_type: string; doc_id: number; amount: number }>;
}) {
  return apiRequest<PaymentApplication>(`${BASE}/pull-from-reconciliation`, {
    method: 'POST',
    data: payload,
  });
}

export async function pullPaymentApplicationFromPurchaseReceipt(payload: {
  purchaseReceiptId: number;
  amount?: number;
}) {
  return apiRequest<PaymentApplication>(`${BASE}/pull-from-purchase-receipt`, {
    method: 'POST',
    data: payload,
  });
}

export async function pullPaymentApplicationFromPurchaseOrder(payload: {
  purchaseOrderId: number;
  amount?: number;
}) {
  return apiRequest<PaymentApplication>(`${BASE}/pull-from-purchase-order`, {
    method: 'POST',
    data: {
      purchase_order_id: payload.purchaseOrderId,
      amount: payload.amount,
    },
  });
}

export async function previewPullPaymentApplicationFromPurchaseOrder(purchaseOrderId: number) {
  return apiRequest<Record<string, unknown>>(`${BASE}/pull-from-purchase-order/preview`, {
    method: 'GET',
    params: { purchase_order_id: purchaseOrderId },
  });
}
