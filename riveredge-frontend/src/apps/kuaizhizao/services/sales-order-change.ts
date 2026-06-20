import { apiRequest } from '../../../services/api';

export interface OrderChangeItem {
  id?: number;
  line_no?: number;
  source_item_id?: number;
  change_type?: string;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  material_unit?: string;
  before_quantity?: number;
  after_quantity?: number;
  before_unit_price?: number;
  after_unit_price?: number;
  before_delivery_date?: string;
  after_delivery_date?: string;
  before_amount?: number;
  after_amount?: number;
  delta_amount?: number;
  notes?: string;
}

export interface SalesOrderChange {
  id?: number;
  change_code?: string;
  source_order_id?: number;
  source_order_code?: string;
  change_version?: number;
  customer_id?: number;
  customer_name?: string;
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
  items?: OrderChangeItem[];
  lifecycle?: Record<string, unknown>;
  header_changes?: Record<string, unknown>;
  notes?: string;
  capabilities?: SalesOrderChangeCapabilities;
}

export interface ActionCapability {
  allowed: boolean;
  reason?: string | null;
}

export interface SalesOrderChangeCapabilities {
  update?: ActionCapability;
  delete?: ActionCapability;
  submit?: ActionCapability;
  withdraw_submit?: ActionCapability;
  approve?: ActionCapability;
  apply?: ActionCapability;
  preview_impact?: ActionCapability;
  print?: ActionCapability;
  reopen?: ActionCapability;
}

export interface ChangeImpactPreview {
  blocking_errors?: string[];
  warnings?: string[];
  affected_demands?: Array<Record<string, unknown>>;
  affected_computations?: Array<Record<string, unknown>>;
  affected_plans?: Array<Record<string, unknown>>;
  affected_work_orders?: Array<Record<string, unknown>>;
  affected_receipt_notices?: Array<Record<string, unknown>>;
  affected_inbounds?: Array<Record<string, unknown>>;
  recommended_actions?: string[];
}

export async function listSalesOrderChanges(params: {
  skip?: number;
  limit?: number;
  source_order_id?: number;
  status?: string;
  lifecycle_stage?: string;
} = {}): Promise<SalesOrderChange[]> {
  return apiRequest('/apps/kuaizhizao/sales-order-change-orders', { method: 'GET', params });
}

export async function listSalesOrderChangesByOrder(orderId: number): Promise<SalesOrderChange[]> {
  return apiRequest(`/apps/kuaizhizao/sales-order-change-orders/by-order/${orderId}`);
}

export async function getSalesOrderChange(id: number): Promise<SalesOrderChange> {
  return apiRequest(`/apps/kuaizhizao/sales-order-change-orders/${id}`);
}

export async function createSalesOrderChangeFromOrder(orderId: number, changeReason = '订单变更'): Promise<SalesOrderChange> {
  return apiRequest(`/apps/kuaizhizao/sales-order-change-orders/from-order/${orderId}`, {
    method: 'POST',
    params: { change_reason: changeReason },
  });
}

export async function updateSalesOrderChange(id: number, data: Partial<SalesOrderChange>): Promise<SalesOrderChange> {
  return apiRequest(`/apps/kuaizhizao/sales-order-change-orders/${id}`, { method: 'PUT', data });
}

export async function deleteSalesOrderChange(id: number): Promise<void> {
  return apiRequest(`/apps/kuaizhizao/sales-order-change-orders/${id}`, { method: 'DELETE' });
}

export async function submitSalesOrderChange(id: number): Promise<SalesOrderChange> {
  return apiRequest(`/apps/kuaizhizao/sales-order-change-orders/${id}/submit`, { method: 'POST' });
}

export async function approveSalesOrderChange(id: number, approved: boolean, reviewRemarks?: string): Promise<SalesOrderChange> {
  return apiRequest(`/apps/kuaizhizao/sales-order-change-orders/${id}/approve`, {
    method: 'POST',
    data: { approved, review_remarks: reviewRemarks },
  });
}

export async function withdrawSalesOrderChange(id: number): Promise<SalesOrderChange> {
  return apiRequest(`/apps/kuaizhizao/sales-order-change-orders/${id}/withdraw`, { method: 'POST' });
}

export async function previewSalesOrderChangeImpact(id: number): Promise<ChangeImpactPreview> {
  return apiRequest(`/apps/kuaizhizao/sales-order-change-orders/${id}/preview-impact`, { method: 'POST' });
}
