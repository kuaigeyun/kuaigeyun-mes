/**
 * 采购退货单类型（API 见 warehouse-execution / production warehouseApi）
 */

export interface ActionCapability {
  allowed: boolean;
  reason?: string | null;
}

export interface PurchaseReturnCapabilities {
  update?: ActionCapability;
  delete?: ActionCapability;
  confirm?: ActionCapability;
  withdraw?: ActionCapability;
  print?: ActionCapability;
}

export interface PurchaseReturn {
  id?: number;
  tenant_id?: number;
  return_code?: string;
  purchase_receipt_id?: number;
  purchase_receipt_code?: string;
  purchase_order_id?: number;
  purchase_order_code?: string;
  supplier_id?: number;
  supplier_name?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  return_time?: string;
  returner_id?: number;
  returner_name?: string;
  reviewer_id?: number;
  reviewer_name?: string;
  review_time?: string;
  review_status?: string;
  review_remarks?: string;
  return_reason?: string;
  return_type?: string;
  status?: string;
  total_quantity?: number;
  total_amount?: number;
  shipping_method?: string;
  tracking_number?: string;
  shipping_address?: string;
  notes?: string;
  attachments?: Array<{ uid?: string; name?: string; url?: string }>;
  created_at?: string;
  updated_at?: string;
  lifecycle?: Record<string, unknown>;
  capabilities?: PurchaseReturnCapabilities;
  items?: PurchaseReturnItem[];
}

export interface PurchaseReturnDetail extends PurchaseReturn {
  items?: PurchaseReturnItem[];
}

export interface PurchaseReturnItem {
  id?: number;
  material_code?: string;
  material_name?: string;
  return_quantity?: number;
  unit_price?: number;
  total_amount?: number;
  batch_number?: string;
  expiry_date?: string;
  location_code?: string;
  serial_numbers?: string[];
  notes?: string;
}
