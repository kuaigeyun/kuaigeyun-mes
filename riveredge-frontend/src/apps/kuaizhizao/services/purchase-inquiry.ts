/**
 * 采购询价单 API
 */

import { apiRequest } from '../../../services/api';

export interface ActionCapability {
  allowed: boolean;
  reason?: string | null;
}

export interface PurchaseInquiryCapabilities {
  update?: ActionCapability;
  delete?: ActionCapability;
  submit?: ActionCapability;
  withdraw_submit?: ActionCapability;
  approve?: ActionCapability;
  revoke_approval?: ActionCapability;
}

export interface PurchaseInquiryItem {
  id?: number;
  inquiry_id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  unit?: string;
  quantity?: number;
  required_date?: string;
  source_requisition_item_id?: number;
  awarded_supplier_id?: number;
  awarded_quote_item_id?: number;
  purchase_order_id?: number;
  notes?: string;
}

export interface PurchaseInquiryVendor {
  id?: number;
  inquiry_id?: number;
  supplier_id?: number;
  supplier_name?: string;
  status?: string;
  quoted_at?: string;
}

export interface PurchaseSupplierQuoteItem {
  id?: number;
  quote_id?: number;
  inquiry_item_id?: number;
  quoted_quantity?: number;
  unit_price?: number;
  delivery_date?: string;
  lead_time_days?: number;
  is_awarded?: boolean;
  notes?: string;
}

export interface PurchaseSupplierQuote {
  id?: number;
  inquiry_id?: number;
  supplier_id?: number;
  supplier_name?: string;
  quote_date?: string;
  valid_until?: string;
  status?: string;
  submission_channel?: string;
  total_amount?: number;
  items?: PurchaseSupplierQuoteItem[];
}

export interface PurchaseInquiry {
  id?: number;
  inquiry_code?: string;
  inquiry_name?: string;
  inquiry_date?: string;
  quote_deadline?: string;
  status?: string;
  buyer_id?: number;
  buyer_name?: string;
  source_type?: string;
  source_id?: number;
  source_code?: string;
  review_status?: string;
  total_quantity?: number;
  notes?: string;
  items?: PurchaseInquiryItem[];
  vendors?: PurchaseInquiryVendor[];
  quotes?: PurchaseSupplierQuote[];
  lifecycle?: Record<string, unknown>;
  capabilities?: PurchaseInquiryCapabilities;
}

export interface ComparisonCell {
  quote_item_id?: number;
  quote_id?: number;
  supplier_id?: number;
  supplier_name?: string;
  unit_price?: number;
  quoted_quantity?: number;
  delivery_date?: string;
  lead_time_days?: number;
  is_lowest_price?: boolean;
  is_awarded?: boolean;
}

export interface ComparisonRow {
  inquiry_item_id: number;
  material_id: number;
  material_code: string;
  material_name: string;
  quantity: number;
  required_date?: string;
  cells: ComparisonCell[];
}

export async function listPurchaseInquiries(params: {
  skip?: number;
  limit?: number;
  lifecycle_stage?: string;
  keyword?: string;
  source_id?: number;
} = {}): Promise<{ data: PurchaseInquiry[]; total: number; success: boolean }> {
  return apiRequest('/apps/kuaizhizao/purchase-inquiries', { method: 'GET', params });
}

export async function getPurchaseInquiry(id: number): Promise<PurchaseInquiry> {
  return apiRequest(`/apps/kuaizhizao/purchase-inquiries/${id}`);
}

export async function createPurchaseInquiry(data: Partial<PurchaseInquiry>): Promise<PurchaseInquiry> {
  return apiRequest('/apps/kuaizhizao/purchase-inquiries', { method: 'POST', data });
}

export async function updatePurchaseInquiry(id: number, data: Partial<PurchaseInquiry>): Promise<PurchaseInquiry> {
  return apiRequest(`/apps/kuaizhizao/purchase-inquiries/${id}`, { method: 'PUT', data });
}

export async function deletePurchaseInquiry(id: number): Promise<void> {
  return apiRequest(`/apps/kuaizhizao/purchase-inquiries/${id}`, { method: 'DELETE' });
}

export async function createInquiryFromRequisition(
  requisitionId: number,
  data: { item_ids: number[]; supplier_ids?: number[]; inquiry_name?: string; quote_deadline?: string; notes?: string },
): Promise<PurchaseInquiry> {
  return apiRequest(`/apps/kuaizhizao/purchase-requisitions/${requisitionId}/push-to-purchase-inquiry`, { method: 'POST', data });
}

export async function publishPurchaseInquiry(id: number): Promise<PurchaseInquiry> {
  return apiRequest(`/apps/kuaizhizao/purchase-inquiries/${id}/publish`, { method: 'POST' });
}

export async function closeInquiryQuoting(id: number): Promise<PurchaseInquiry> {
  return apiRequest(`/apps/kuaizhizao/purchase-inquiries/${id}/close-quoting`, { method: 'POST' });
}

export async function getInquiryComparison(id: number): Promise<{ inquiry_id: number; suppliers: PurchaseInquiryVendor[]; rows: ComparisonRow[] }> {
  return apiRequest(`/apps/kuaizhizao/purchase-inquiries/${id}/comparison`, { method: 'GET' });
}

export async function upsertSupplierQuote(
  inquiryId: number,
  data: {
    supplier_id: number;
    supplier_name?: string;
    quote_date?: string;
    valid_until?: string;
    notes?: string;
    items: Array<{
      inquiry_item_id: number;
      quoted_quantity?: number;
      unit_price?: number;
      delivery_date?: string;
      lead_time_days?: number;
      notes?: string;
    }>;
  },
): Promise<PurchaseSupplierQuote> {
  return apiRequest(`/apps/kuaizhizao/purchase-inquiries/${inquiryId}/supplier-quotes`, { method: 'POST', data });
}

export async function awardInquiryQuotes(
  inquiryId: number,
  awards: Array<{ inquiry_item_id: number; quote_item_id: number }>,
): Promise<PurchaseInquiry> {
  return apiRequest(`/apps/kuaizhizao/purchase-inquiries/${inquiryId}/award`, { method: 'POST', data: { awards } });
}

export async function convertInquiryToPurchaseOrder(
  inquiryId: number,
  data?: { item_ids?: number[]; persist_default_supplier_to_material?: boolean },
): Promise<{ purchase_orders: Array<{ purchase_order_id: number; purchase_order_code: string; supplier_id: number }> }> {
  return apiRequest(`/apps/kuaizhizao/purchase-inquiries/${inquiryId}/convert-to-purchase-order`, { method: 'POST', data: data ?? {} });
}

export async function submitPurchaseInquiry(id: number): Promise<PurchaseInquiry> {
  return apiRequest(`/apps/kuaizhizao/purchase-inquiries/${id}/submit`, { method: 'POST' });
}

export async function approvePurchaseInquiry(id: number, approved: boolean, review_remarks?: string): Promise<PurchaseInquiry> {
  return apiRequest(`/apps/kuaizhizao/purchase-inquiries/${id}/approve`, { method: 'POST', data: { approved, review_remarks } });
}

export async function withdrawPurchaseInquiryApproval(id: number): Promise<PurchaseInquiry> {
  return apiRequest(`/apps/kuaizhizao/purchase-inquiries/${id}/withdraw-approval`, { method: 'POST' });
}

/** 撤回提交（待审核 -> 草稿），走统一审核入口 */
export async function withdrawPurchaseInquirySubmit(id: number): Promise<PurchaseInquiry> {
  return apiRequest(`/core/uni-audit/purchase_inquiry/${id}/withdraw`, { method: 'POST' });
}
