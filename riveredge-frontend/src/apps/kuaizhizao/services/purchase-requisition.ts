/**
 * 采购申请API服务
 */

import { apiRequest } from '../../../services/api';

export interface ActionCapability {
  allowed: boolean;
  reason?: string | null;
}

export interface PurchaseRequisitionCapabilities {
  update?: ActionCapability;
  delete?: ActionCapability;
  submit?: ActionCapability;
  approve?: ActionCapability;
  revoke_approval?: ActionCapability;
}

export interface PurchaseRequisitionLifecycle {
  status_class?: string;
  flow_class?: string;
  current_stage_key?: string;
  current_stage_name?: string;
  status?: string;
  main_stages?: Array<{ key?: string; label?: string; status?: string }>;
  sub_stages?: Array<{ key?: string; label?: string; status?: string }>;
}

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
  converted_quantity_draft?: number;
  converted_quantity_confirmed?: number;
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
  review_status?: string;
  notes?: string;
  items_count?: number;
  items?: PurchaseRequisitionItem[];
  created_at?: string;
  updated_at?: string;
  lifecycle?: PurchaseRequisitionLifecycle;
  capabilities?: PurchaseRequisitionCapabilities;
}

export async function listPurchaseRequisitions(params: {
  skip?: number;
  limit?: number;
  status?: string;
  lifecycle_stage?: string;
  source_type?: string;
  keyword?: string;
  requisition_code?: string;
  requisition_name?: string;
  required_date_from?: string;
  required_date_to?: string;
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

export async function withdrawPurchaseRequisition(id: number): Promise<PurchaseRequisition> {
  return apiRequest(`/apps/kuaizhizao/purchase-requisitions/${id}/withdraw-approval`, {
    method: 'POST',
  });
}

/** 撤回提交（待审核 -> 草稿），走统一审核入口 */
export async function withdrawPurchaseRequisitionSubmit(id: number): Promise<PurchaseRequisition> {
  return apiRequest(`/core/uni-audit/purchase_request/${id}/withdraw`, {
    method: 'POST',
  });
}

export async function fixPurchaseRequisitionStatus(id: number): Promise<PurchaseRequisition> {
  return apiRequest(`/apps/kuaizhizao/purchase-requisitions/${id}/fix-status`, {
    method: 'POST',
  });
}

export async function convertToPurchaseOrder(
  requisitionId: number,
  data: {
    item_ids: number[];
    supplier_id?: number;
    supplier_name?: string;
    item_quantities?: Record<number, number>;
    item_unit_prices?: Record<number, number>;
    /** 申请行 id -> 供应商 id，优先于行上 supplier_id */
    item_suppliers?: Record<number, number>;
    /** 转单成功后写回采购件物料默认供应商 */
    persist_default_supplier_to_material?: boolean;
  }
): Promise<{
  success: boolean;
  message: string;
  purchase_order_id: number;
  purchase_order_code: string;
  purchase_orders?: Array<{ purchase_order_id: number; purchase_order_code: string; supplier_id: number }>;
  persisted_material_ids?: number[];
}> {
  return apiRequest(`/apps/kuaizhizao/purchase-requisitions/${requisitionId}/convert-to-purchase-order`, {
    method: 'POST',
    data,
  });
}

export interface PriceComparisonItem {
  supplier_id: number;
  supplier_name: string;
  last_price: number;
  last_order_date?: string;
  delivery_lead_time: number;
}

export interface MaterialPriceComparison {
  material_id: number;
  material_code?: string;
  material_name: string;
  /** 后端字段名 comparison */
  comparison: PriceComparisonItem[];
}

export interface PriceComparisonResponse {
  results: MaterialPriceComparison[];
}

/** 获取多个物料的价格对比助手数据 */
export async function getPriceComparison(materialIds: number[]): Promise<PriceComparisonResponse> {
  return apiRequest('/apps/kuaizhizao/price-comparison', {
    method: 'GET',
    params: { material_ids: materialIds.join(',') },
  });
}
