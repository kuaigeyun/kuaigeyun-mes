/**
 * 采购询价单 API
 */

import { apiRequest } from '../../../services/api';
import type { DocumentPushPreview } from './purchase-requisition';

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
  push_purchase_order?: ActionCapability;
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
  items_count?: number;
  total_quantity?: number;
  total_amount?: number;
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
  inquiry_code?: string;
  inquiry_name?: string;
  source_code?: string;
  quote_deadline_from?: string;
  quote_deadline_to?: string;
  created_start_date?: string;
  created_end_date?: string;
  source_id?: number;
  order_by?: string;
  /** 明细表格视图才需要附带 items；普通列表勿开 */
  include_items?: boolean;
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

export type PurchaseInquiryPurchasePullLine = {
  id: number;
  inquiry_id: number;
  inquiry_code?: string;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string | null;
  unit?: string;
  suggested_quantity?: number;
  pushed_quantity?: number;
  remaining_quantity?: number;
  required_date?: string | null;
  awarded_supplier_id?: number | null;
};

export async function listPurchaseInquiryPurchaseOrderPullLines(params: {
  skip?: number;
  limit?: number;
  keyword?: string;
  inquiry_id?: number;
  pullable_only?: boolean;
}): Promise<{ data: PurchaseInquiryPurchasePullLine[]; total: number }> {
  return apiRequest('/apps/kuaizhizao/purchase-inquiries/purchase-order-pull-lines', {
    method: 'GET',
    params,
  });
}

export async function pullPurchaseInquiryFromRequisitionItems(
  selectedItemIds: number[],
): Promise<PurchaseInquiry> {
  return apiRequest('/apps/kuaizhizao/purchase-inquiries/pull-from-requisition-items', {
    method: 'POST',
    data: { selected_item_ids: selectedItemIds },
  });
}

export async function pullPurchaseOrdersFromInquiryItems(
  selectedItemIds: number[],
): Promise<{
  success: boolean;
  message: string;
  purchase_order_id?: number;
  purchase_order_code?: string;
  purchase_orders?: Array<{ purchase_order_id: number; purchase_order_code: string; supplier_id: number }>;
}> {
  return apiRequest('/apps/kuaizhizao/purchase-orders/pull-from-inquiry-items', {
    method: 'POST',
    data: { selected_item_ids: selectedItemIds },
  });
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

export async function previewPushInquiryToPurchaseOrder(inquiryId: number): Promise<DocumentPushPreview> {
  return apiRequest(`/apps/kuaizhizao/purchase-inquiries/${inquiryId}/push-to-purchase-order/preview`, {
    method: 'GET',
  });
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
