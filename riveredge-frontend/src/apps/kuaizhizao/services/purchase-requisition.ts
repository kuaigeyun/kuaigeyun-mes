/**
 * 采购申请API服务
 */

import { apiRequest } from '../../../services/api';

export interface PurchaseRequisitionItem {
  id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  unit?: string;
  quantity?: number;
  suggested_unit_price?: number;
  required_date?: string;
  supplier_id?: number;
  purchase_order_id?: number;
  purchase_order_item_id?: number;
  demand_computation_item_id?: number;
  notes?: string;
}

export interface PurchaseRequisition {
  id?: number;
  requisition_code?: string;
  requisition_name?: string;
  status?: string;
  applicant_id?: number;
  applicant_name?: string;
  requisition_date?: string;
  required_date?: string;
  source_type?: string;
  source_id?: number;
  source_code?: string;
  is_urgent?: boolean;
  urgent_reason?: string;
  review_status?: string;
  notes?: string;
  items_count?: number;
  items?: PurchaseRequisitionItem[];
  created_at?: string;
  updated_at?: string;
}

export async function listPurchaseRequisitions(params: {
  skip?: number;
  limit?: number;
  status?: string;
  source_type?: string;
} = {}): Promise<{ data: PurchaseRequisition[]; total: number; success: boolean }> {
  return apiRequest('/apps/kuaizhizao/purchase-requisitions', { method: 'GET', params });
}

export async function getPurchaseRequisition(id: number): Promise<PurchaseRequisition> {
  return apiRequest(`/apps/kuaizhizao/purchase-requisitions/${id}`);
}

export async function createPurchaseRequisition(data: Partial<PurchaseRequisition>): Promise<PurchaseRequisition> {
  return apiRequest('/apps/kuaizhizao/purchase-requisitions', { method: 'POST', data });
}

export async function updatePurchaseRequisition(id: number, data: Partial<PurchaseRequisition>): Promise<PurchaseRequisition> {
  return apiRequest(`/apps/kuaizhizao/purchase-requisitions/${id}`, { method: 'PUT', data });
}

export async function deletePurchaseRequisition(id: number): Promise<void> {
  return apiRequest(`/apps/kuaizhizao/purchase-requisitions/${id}`, { method: 'DELETE' });
}

export async function submitPurchaseRequisition(id: number): Promise<PurchaseRequisition> {
  return apiRequest(`/apps/kuaizhizao/purchase-requisitions/${id}/submit`, { method: 'POST' });
}

export async function approvePurchaseRequisition(
  id: number,
  data: { approved: boolean; review_remarks?: string }
): Promise<PurchaseRequisition> {
  return apiRequest(`/apps/kuaizhizao/purchase-requisitions/${id}/approve`, {
    method: 'POST',
    data,
  });
}

export async function convertToPurchaseOrder(
  requisitionId: number,
  data: { item_ids: number[]; supplier_id: number; supplier_name: string }
): Promise<{ success: boolean; message: string; purchase_order_id: number; purchase_order_code: string }> {
  return apiRequest(`/apps/kuaizhizao/purchase-requisitions/${requisitionId}/convert-to-purchase-order`, {
    method: 'POST',
    data,
  });
}

export async function urgentPurchase(
  requisitionId: number,
  data: { urgent_reason: string }
): Promise<{ success: boolean; message: string; purchase_orders: Array<{ id: number; code: string }> }> {
  return apiRequest(`/apps/kuaizhizao/purchase-requisitions/${requisitionId}/urgent-purchase`, {
    method: 'POST',
    data,
  });
}
