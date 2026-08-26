import { apiRequest } from '../../../services/api';
import type { ChangeImpactPreview, OrderChangeItem } from './sales-order-change';
import type { DocumentPushPreview } from './purchase';

export interface ActionCapability {
  allowed: boolean;
  reason?: string | null;
}

export interface PurchaseOrderChangeCapabilities {
  update?: ActionCapability;
  delete?: ActionCapability;
  submit?: ActionCapability;
  withdraw_submit?: ActionCapability;
  approve?: ActionCapability;
  revoke_approval?: ActionCapability;
  apply?: ActionCapability;
  preview_impact?: ActionCapability;
  print?: ActionCapability;
  reopen?: ActionCapability;
}

export interface PurchaseOrderChange {
  id?: number;
  change_code?: string;
  source_order_id?: number;
  source_order_code?: string;
  change_version?: number;
  supplier_id?: number;
  supplier_name?: string;
  partner_name?: string;
  change_category?: string;
  change_reason?: string;
  status?: string;
  review_status?: string;
  before_total_quantity?: number;
  after_total_quantity?: number;
  before_total_amount?: number;
  after_total_amount?: number;
  delta_amount?: number;
  applied_at?: string;
  created_at?: string;
  updated_at?: string;
  items?: OrderChangeItem[];
  lifecycle?: Record<string, unknown>;
  header_changes?: Record<string, unknown>;
  notes?: string;
  capabilities?: PurchaseOrderChangeCapabilities;
}

export interface PurchaseOrderChangeListParams {
  skip?: number;
  limit?: number;
  source_order_id?: number;
  status?: string;
  lifecycle_stage?: string;
  supplier_id?: number;
  change_category?: string;
  keyword?: string;
  change_code?: string;
  source_order_code?: string;
  start_date?: string;
  end_date?: string;
  order_by?: string;
}

export interface PurchaseOrderChangeListResult {
  items: PurchaseOrderChange[];
  total: number;
}

export async function listPurchaseOrderChanges(
  params: PurchaseOrderChangeListParams = {},
): Promise<PurchaseOrderChangeListResult> {
  return apiRequest('/apps/kuaizhizao/purchase-order-change-orders', { method: 'GET', params });
}

export async function listPurchaseOrderChangesByOrder(orderId: number): Promise<PurchaseOrderChange[]> {
  return apiRequest(`/apps/kuaizhizao/purchase-order-change-orders/by-order/${orderId}`);
}

export async function getPurchaseOrderChange(id: number): Promise<PurchaseOrderChange> {
  return apiRequest(`/apps/kuaizhizao/purchase-order-change-orders/${id}`);
}

export async function createPurchaseOrderChangeFromOrder(orderId: number, changeReason = '订单变更'): Promise<PurchaseOrderChange> {
  return apiRequest(`/apps/kuaizhizao/purchase-order-change-orders/from-order/${orderId}`, {
    method: 'POST',
    params: { change_reason: changeReason },
  });
}

export async function previewPurchaseOrderChangeFromOrder(orderId: number): Promise<DocumentPushPreview> {
  return apiRequest(`/apps/kuaizhizao/purchase-order-change-orders/from-order/${orderId}/preview`);
}

export async function updatePurchaseOrderChange(id: number, data: Partial<PurchaseOrderChange>): Promise<PurchaseOrderChange> {
  return apiRequest(`/apps/kuaizhizao/purchase-order-change-orders/${id}`, { method: 'PUT', data });
}

export async function deletePurchaseOrderChange(id: number): Promise<void> {
  return apiRequest(`/apps/kuaizhizao/purchase-order-change-orders/${id}`, { method: 'DELETE' });
}

export async function submitPurchaseOrderChange(id: number): Promise<PurchaseOrderChange> {
  return apiRequest(`/apps/kuaizhizao/purchase-order-change-orders/${id}/submit`, { method: 'POST' });
}

export async function approvePurchaseOrderChange(id: number, approved: boolean, reviewRemarks?: string): Promise<PurchaseOrderChange> {
  return apiRequest(`/apps/kuaizhizao/purchase-order-change-orders/${id}/approve`, {
    method: 'POST',
    data: { approved, review_remarks: reviewRemarks },
  });
}

export async function withdrawPurchaseOrderChange(id: number): Promise<PurchaseOrderChange> {
  return apiRequest(`/apps/kuaizhizao/purchase-order-change-orders/${id}/withdraw`, { method: 'POST' });
}

export async function previewPurchaseOrderChangeImpact(id: number): Promise<ChangeImpactPreview> {
  return apiRequest(`/apps/kuaizhizao/purchase-order-change-orders/${id}/preview-impact`, { method: 'POST' });
}

export async function applyPurchaseOrderChange(id: number): Promise<PurchaseOrderChange> {
  return apiRequest(`/apps/kuaizhizao/purchase-order-change-orders/${id}/apply`, { method: 'POST' });
}

export type { ChangeImpactPreview, OrderChangeItem };
