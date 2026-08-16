import { apiRequest } from '../../../services/api';

const BASE = '/apps/kuaizhizao/after-sales';

export type PagedList<T> = { items: T[]; total: number };

export type ListParams = {
  skip?: number;
  limit?: number;
  keyword?: string;
  status?: string;
  customer_id?: number;
  after_sales_ticket_id?: number;
  order_by?: string;
};

export type ServiceAsset = {
  id: number;
  uuid?: string;
  asset_code: string;
  customer_id: number;
  customer_name: string;
  material_id?: number | null;
  material_code?: string | null;
  material_name?: string | null;
  material_spec?: string | null;
  serial_number?: string | null;
  sales_order_id?: number | null;
  sales_order_code?: string | null;
  sales_delivery_id?: number | null;
  sales_delivery_code?: string | null;
  install_execution_id?: number | null;
  install_execution_code?: string | null;
  install_address?: string | null;
  accepted_at?: string | null;
  warranty_start_at?: string | null;
  warranty_end_at?: string | null;
  warranty_months?: number | null;
  warranty_policy?: string | null;
  status?: string;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ServiceAssetPayload = Partial<
  Omit<ServiceAsset, 'id' | 'uuid' | 'asset_code' | 'created_at' | 'updated_at'>
> & {
  customer_id: number;
  customer_name: string;
};

export type RepairOrderItem = {
  id?: number;
  line_no?: number;
  material_id?: number | null;
  material_code?: string | null;
  material_name?: string | null;
  material_spec?: string | null;
  material_unit?: string | null;
  quantity?: number | string | null;
  unit_price?: number | string | null;
  amount?: number | string | null;
  notes?: string | null;
};

export type RepairOrder = {
  id: number;
  uuid?: string;
  order_code: string;
  customer_id: number;
  customer_name: string;
  after_sales_ticket_id?: number | null;
  after_sales_ticket_code?: string | null;
  service_asset_id?: number | null;
  service_asset_code?: string | null;
  repair_mode?: string;
  fault_category?: string | null;
  fault_description: string;
  diagnosis_result?: string | null;
  resolution?: string | null;
  warranty_status?: string;
  warranty_override_reason?: string | null;
  labor_cost?: number | string | null;
  travel_cost?: number | string | null;
  spare_part_cost?: number | string | null;
  outsource_cost?: number | string | null;
  total_cost?: number | string | null;
  status?: string;
  site_address?: string | null;
  reported_at: string;
  closed_at?: string | null;
  notes?: string | null;
  items?: RepairOrderItem[];
  created_at?: string;
  updated_at?: string;
};

export type RepairOrderPayload = Partial<
  Omit<RepairOrder, 'id' | 'uuid' | 'order_code' | 'created_at' | 'updated_at'>
> & {
  customer_id: number;
  customer_name: string;
  fault_description: string;
  reported_at: string;
  items?: RepairOrderItem[];
};

export type ServiceDispatchOrder = {
  id: number;
  uuid?: string;
  dispatch_code: string;
  customer_id: number;
  customer_name: string;
  source_type: string;
  source_id: number;
  source_code: string;
  engineer_id?: number | null;
  engineer_name?: string | null;
  planned_start_at?: string | null;
  planned_end_at?: string | null;
  actual_start_at?: string | null;
  actual_end_at?: string | null;
  site_address?: string | null;
  status?: string;
  checkin_at?: string | null;
  checkin_location?: string | null;
  completion_notes?: string | null;
  attachments?: unknown;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ServiceDispatchPayload = Partial<
  Omit<ServiceDispatchOrder, 'id' | 'uuid' | 'dispatch_code' | 'created_at' | 'updated_at'>
> & {
  customer_id: number;
  customer_name: string;
  source_type: string;
  source_id: number;
  source_code: string;
};

export type AfterSalesSparePartRequisitionItem = {
  id?: number;
  line_no?: number;
  material_id?: number | null;
  material_code?: string | null;
  material_name?: string | null;
  material_spec?: string | null;
  material_unit?: string | null;
  quantity?: number | string | null;
  notes?: string | null;
};

export type AfterSalesSparePartRequisition = {
  id: number;
  uuid?: string;
  requisition_code: string;
  source_type: string;
  source_id: number;
  source_code: string;
  warehouse_id?: number | null;
  warehouse_name?: string | null;
  other_outbound_id?: number | null;
  other_outbound_code?: string | null;
  status?: string;
  reviewer_id?: number | null;
  reviewer_name?: string | null;
  reviewed_at?: string | null;
  review_remarks?: string | null;
  notes?: string | null;
  items?: AfterSalesSparePartRequisitionItem[];
  created_at?: string;
  updated_at?: string;
};

export type AfterSalesSparePartRequisitionPayload = Partial<
  Omit<
    AfterSalesSparePartRequisition,
    'id' | 'uuid' | 'requisition_code' | 'created_at' | 'updated_at'
  >
> & {
  source_type: string;
  source_id: number;
  source_code: string;
  items?: AfterSalesSparePartRequisitionItem[];
};

export type ServiceSettlementItem = {
  id?: number;
  line_no?: number;
  source_type: string;
  source_id: number;
  source_code: string;
  warranty_status?: string | null;
  amount?: number | string | null;
  notes?: string | null;
};

export type ServiceSettlement = {
  id: number;
  uuid?: string;
  settlement_code: string;
  customer_id: number;
  customer_name: string;
  warranty_free_amount?: number | string | null;
  chargeable_amount?: number | string | null;
  total_amount?: number | string | null;
  status?: string;
  reviewer_id?: number | null;
  reviewer_name?: string | null;
  reviewed_at?: string | null;
  review_remarks?: string | null;
  notes?: string | null;
  items?: ServiceSettlementItem[];
  created_at?: string;
  updated_at?: string;
};

export type ServiceSettlementPayload = Partial<
  Omit<ServiceSettlement, 'id' | 'uuid' | 'settlement_code' | 'created_at' | 'updated_at'>
> & {
  customer_id: number;
  customer_name: string;
  items?: ServiceSettlementItem[];
};

export type CustomerReturnVisit = {
  id: number;
  uuid?: string;
  visit_code: string;
  customer_id: number;
  customer_name: string;
  source_type: string;
  source_id: number;
  source_code: string;
  visit_method?: string;
  satisfaction_score?: number | null;
  feedback?: string | null;
  visitor_id?: number | null;
  visitor_name?: string | null;
  visited_at: string;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type CustomerReturnVisitPayload = Partial<
  Omit<CustomerReturnVisit, 'id' | 'uuid' | 'visit_code' | 'created_at' | 'updated_at'>
> & {
  customer_id: number;
  customer_name: string;
  source_type: string;
  source_id: number;
  source_code: string;
  visited_at: string;
};

function buildQuery(params?: ListParams): string {
  if (!params) return '';
  const q = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== '') q.set(key, String(value));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const serviceAssetApi = {
  list: (params?: ListParams) =>
    apiRequest<PagedList<ServiceAsset>>(`${BASE}/service-assets${buildQuery(params)}`),
  get: (id: number) => apiRequest<ServiceAsset>(`${BASE}/service-assets/${id}`),
  create: (payload: ServiceAssetPayload) =>
    apiRequest<ServiceAsset>(`${BASE}/service-assets`, { method: 'POST', body: payload }),
  update: (id: number, payload: Partial<ServiceAssetPayload>) =>
    apiRequest<ServiceAsset>(`${BASE}/service-assets/${id}`, { method: 'PUT', body: payload }),
  delete: (id: number) =>
    apiRequest<void>(`${BASE}/service-assets/${id}`, { method: 'DELETE' }),
};

export const repairOrderApi = {
  list: (params?: ListParams) =>
    apiRequest<PagedList<RepairOrder>>(`${BASE}/repair-orders${buildQuery(params)}`),
  get: (id: number) => apiRequest<RepairOrder>(`${BASE}/repair-orders/${id}`),
  create: (payload: RepairOrderPayload) =>
    apiRequest<RepairOrder>(`${BASE}/repair-orders`, { method: 'POST', body: payload }),
  update: (id: number, payload: Partial<RepairOrderPayload>) =>
    apiRequest<RepairOrder>(`${BASE}/repair-orders/${id}`, { method: 'PUT', body: payload }),
  close: (id: number) =>
    apiRequest<RepairOrder>(`${BASE}/repair-orders/${id}/close`, { method: 'POST' }),
  delete: (id: number) =>
    apiRequest<void>(`${BASE}/repair-orders/${id}`, { method: 'DELETE' }),
};

export const serviceDispatchApi = {
  list: (params?: ListParams) =>
    apiRequest<PagedList<ServiceDispatchOrder>>(`${BASE}/dispatch-orders${buildQuery(params)}`),
  get: (id: number) => apiRequest<ServiceDispatchOrder>(`${BASE}/dispatch-orders/${id}`),
  create: (payload: ServiceDispatchPayload) =>
    apiRequest<ServiceDispatchOrder>(`${BASE}/dispatch-orders`, { method: 'POST', body: payload }),
  update: (id: number, payload: Partial<ServiceDispatchPayload>) =>
    apiRequest<ServiceDispatchOrder>(`${BASE}/dispatch-orders/${id}`, { method: 'PUT', body: payload }),
  assign: (id: number, payload: { engineer_id?: number; engineer_name?: string }) =>
    apiRequest<ServiceDispatchOrder>(`${BASE}/dispatch-orders/${id}/assign`, {
      method: 'POST',
      body: payload,
    }),
  close: (id: number) =>
    apiRequest<ServiceDispatchOrder>(`${BASE}/dispatch-orders/${id}/close`, { method: 'POST' }),
  delete: (id: number) =>
    apiRequest<void>(`${BASE}/dispatch-orders/${id}`, { method: 'DELETE' }),
};

export const afterSalesSparePartRequisitionApi = {
  list: (params?: ListParams) =>
    apiRequest<PagedList<AfterSalesSparePartRequisition>>(
      `${BASE}/spare-part-requisitions${buildQuery(params)}`,
    ),
  get: (id: number) =>
    apiRequest<AfterSalesSparePartRequisition>(`${BASE}/spare-part-requisitions/${id}`),
  create: (payload: AfterSalesSparePartRequisitionPayload) =>
    apiRequest<AfterSalesSparePartRequisition>(`${BASE}/spare-part-requisitions`, {
      method: 'POST',
      body: payload,
    }),
  update: (id: number, payload: Partial<AfterSalesSparePartRequisitionPayload>) =>
    apiRequest<AfterSalesSparePartRequisition>(`${BASE}/spare-part-requisitions/${id}`, {
      method: 'PUT',
      body: payload,
    }),
  submit: (id: number) =>
    apiRequest<AfterSalesSparePartRequisition>(`${BASE}/spare-part-requisitions/${id}/submit`, {
      method: 'POST',
    }),
  audit: (id: number, payload?: { review_remarks?: string }) =>
    apiRequest<AfterSalesSparePartRequisition>(`${BASE}/spare-part-requisitions/${id}/audit`, {
      method: 'POST',
      body: payload ?? {},
    }),
  reject: (id: number, payload?: { review_remarks?: string }) =>
    apiRequest<AfterSalesSparePartRequisition>(`${BASE}/spare-part-requisitions/${id}/reject`, {
      method: 'POST',
      body: payload ?? {},
    }),
  delete: (id: number) =>
    apiRequest<void>(`${BASE}/spare-part-requisitions/${id}`, { method: 'DELETE' }),
};

export const serviceSettlementApi = {
  list: (params?: ListParams) =>
    apiRequest<PagedList<ServiceSettlement>>(`${BASE}/service-settlements${buildQuery(params)}`),
  get: (id: number) => apiRequest<ServiceSettlement>(`${BASE}/service-settlements/${id}`),
  create: (payload: ServiceSettlementPayload) =>
    apiRequest<ServiceSettlement>(`${BASE}/service-settlements`, { method: 'POST', body: payload }),
  update: (id: number, payload: Partial<ServiceSettlementPayload>) =>
    apiRequest<ServiceSettlement>(`${BASE}/service-settlements/${id}`, {
      method: 'PUT',
      body: payload,
    }),
  audit: (id: number, payload?: { review_remarks?: string }) =>
    apiRequest<ServiceSettlement>(`${BASE}/service-settlements/${id}/audit`, {
      method: 'POST',
      body: payload ?? {},
    }),
  reject: (id: number, payload?: { review_remarks?: string }) =>
    apiRequest<ServiceSettlement>(`${BASE}/service-settlements/${id}/reject`, {
      method: 'POST',
      body: payload ?? {},
    }),
  delete: (id: number) =>
    apiRequest<void>(`${BASE}/service-settlements/${id}`, { method: 'DELETE' }),
};

export const customerReturnVisitApi = {
  list: (params?: ListParams) =>
    apiRequest<PagedList<CustomerReturnVisit>>(`${BASE}/return-visits${buildQuery(params)}`),
  get: (id: number) => apiRequest<CustomerReturnVisit>(`${BASE}/return-visits/${id}`),
  create: (payload: CustomerReturnVisitPayload) =>
    apiRequest<CustomerReturnVisit>(`${BASE}/return-visits`, { method: 'POST', body: payload }),
  update: (id: number, payload: Partial<CustomerReturnVisitPayload>) =>
    apiRequest<CustomerReturnVisit>(`${BASE}/return-visits/${id}`, { method: 'PUT', body: payload }),
  delete: (id: number) =>
    apiRequest<void>(`${BASE}/return-visits/${id}`, { method: 'DELETE' }),
};
