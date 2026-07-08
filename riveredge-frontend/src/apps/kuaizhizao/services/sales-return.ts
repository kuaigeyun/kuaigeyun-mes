/**
 * 销售退货单类型（API 见 warehouse-execution / production warehouseApi）
 */

export interface ActionCapability {
  allowed: boolean;
  reason?: string | null;
}

export interface SalesReturnCapabilities {
  update: ActionCapability;
  delete: ActionCapability;
  confirm: ActionCapability;
  withdraw: ActionCapability;
  print: ActionCapability;
}

export interface SalesReturn {
  id?: number;
  return_code?: string;
  sales_delivery_id?: number;
  sales_delivery_code?: string;
  sales_order_id?: number;
  sales_order_code?: string;
  customer_id?: number;
  customer_name?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  return_time?: string;
  return_reason?: string;
  return_type?: string;
  status?: string;
  review_status?: string;
  total_quantity?: number;
  total_amount?: number;
  notes?: string;
  attachments?: Array<{ uid?: string; name?: string; url?: string }>;
  lifecycle?: Record<string, unknown>;
  capabilities?: SalesReturnCapabilities;
  audit?: {
    phase?: string;
    enabled?: boolean;
    mode?: string;
  } | null;
  items?: SalesReturnItem[];
}

export interface SalesReturnListParams {
  skip?: number;
  limit?: number;
  status?: string;
  sales_delivery_id?: number;
  customer_id?: number;
  warehouse_id?: number;
  keyword?: string;
  return_code?: string;
  sales_delivery_code?: string;
  sales_order_code?: string;
  return_start_date?: string;
  return_end_date?: string;
  created_start_date?: string;
  created_end_date?: string;
  order_by?: string;
}

export interface SalesReturnListResult {
  data: SalesReturn[];
  total: number;
  success?: boolean;
}

export interface SalesReturnItem {
  id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  material_unit?: string;
  return_quantity?: number;
  unit_price?: number;
  total_amount?: number;
  batch_number?: string;
  location_code?: string;
  sales_delivery_item_id?: number;
  notes?: string;
}
