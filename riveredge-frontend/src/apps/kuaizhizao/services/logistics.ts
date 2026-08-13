import { apiRequest } from '../../../services/api';

const BASE = '/apps/kuaizhizao/logistics';

export type LogisticsCarrier = {
  id: number;
  uuid: string;
  code: string;
  name: string;
  carrier_type: string;
  contact_name?: string;
  contact_phone?: string;
  settlement_method?: string;
  supplier_id?: number;
  remark?: string;
  is_enabled: boolean;
};

export type Vehicle = {
  id: number;
  uuid: string;
  plate_number: string;
  vehicle_type?: string;
  load_capacity?: number;
  volume_capacity?: number;
  ownership: string;
  carrier_id?: number;
  status: string;
  remark?: string;
  is_enabled: boolean;
};

export type Driver = {
  id: number;
  uuid: string;
  code: string;
  name: string;
  phone?: string;
  license_number?: string;
  ownership: string;
  carrier_id?: number;
  user_id?: number;
  default_vehicle_id?: number;
  remark?: string;
  is_enabled: boolean;
};

export type FreightOrderSource = {
  id?: number;
  source_type: string;
  source_id: number;
  source_code: string;
  partner_name?: string;
};

export type FreightTrackingEvent = {
  id: number;
  event_type: string;
  event_time: string;
  location?: string;
  remark?: string;
  operator_name?: string;
};

export type FreightOrder = {
  id: number;
  uuid: string;
  order_code: string;
  business_direction: string;
  transport_mode: string;
  carrier_id?: number;
  carrier_name?: string;
  vehicle_id?: number;
  vehicle_plate?: string;
  driver_id?: number;
  driver_name?: string;
  driver_phone?: string;
  tracking_number?: string;
  origin_address?: string;
  destination_address?: string;
  planned_depart_at?: string;
  planned_arrive_at?: string;
  actual_depart_at?: string;
  actual_arrive_at?: string;
  status: string;
  remark?: string;
  sources?: FreightOrderSource[];
  tracking_events?: FreightTrackingEvent[];
  receipt?: Record<string, unknown>;
};

export type FreightPullCandidate = {
  source_type: string;
  source_id: number;
  source_code: string;
  partner_name: string;
  business_direction: string;
  address?: string;
  tracking_number?: string;
};

export type FreightBillItem = {
  id?: number;
  freight_order_id: number;
  freight_order_code?: string;
  fee_type: string;
  amount: number;
  remark?: string;
};

export type FreightBill = {
  id: number;
  uuid: string;
  bill_code: string;
  carrier_id: number;
  carrier_name: string;
  period_start?: string;
  period_end?: string;
  total_amount: number;
  status: string;
  review_status: string;
  payable_id?: number;
  payable_code?: string;
  remark?: string;
  items?: FreightBillItem[];
};

type ListParams = { skip?: number; limit?: number; keyword?: string };

export async function listCarriers(params: ListParams = {}) {
  return apiRequest<{ items: LogisticsCarrier[]; total: number }>(`${BASE}/carriers`, { method: 'GET', params });
}

export async function createCarrier(data: Partial<LogisticsCarrier>) {
  return apiRequest<LogisticsCarrier>(`${BASE}/carriers`, { method: 'POST', data });
}

export async function updateCarrier(id: number, data: Partial<LogisticsCarrier>) {
  return apiRequest<LogisticsCarrier>(`${BASE}/carriers/${id}`, { method: 'PUT', data });
}

export async function deleteCarrier(id: number) {
  return apiRequest<void>(`${BASE}/carriers/${id}`, { method: 'DELETE' });
}

export async function listVehicles(params: ListParams & { ownership?: string } = {}) {
  return apiRequest<{ items: Vehicle[]; total: number }>(`${BASE}/vehicles`, { method: 'GET', params });
}

export async function createVehicle(data: Partial<Vehicle>) {
  return apiRequest<Vehicle>(`${BASE}/vehicles`, { method: 'POST', data });
}

export async function updateVehicle(id: number, data: Partial<Vehicle>) {
  return apiRequest<Vehicle>(`${BASE}/vehicles/${id}`, { method: 'PUT', data });
}

export async function deleteVehicle(id: number) {
  return apiRequest<void>(`${BASE}/vehicles/${id}`, { method: 'DELETE' });
}

export async function listDrivers(params: ListParams & { ownership?: string } = {}) {
  return apiRequest<{ items: Driver[]; total: number }>(`${BASE}/drivers`, { method: 'GET', params });
}

export async function createDriver(data: Partial<Driver>) {
  return apiRequest<Driver>(`${BASE}/drivers`, { method: 'POST', data });
}

export async function updateDriver(id: number, data: Partial<Driver>) {
  return apiRequest<Driver>(`${BASE}/drivers/${id}`, { method: 'PUT', data });
}

export async function deleteDriver(id: number) {
  return apiRequest<void>(`${BASE}/drivers/${id}`, { method: 'DELETE' });
}

export async function listFreightOrders(params: ListParams & { status?: string; business_direction?: string } = {}) {
  return apiRequest<{ items: FreightOrder[]; total: number }>(`${BASE}/freight-orders`, { method: 'GET', params });
}

export async function getFreightOrder(id: number) {
  return apiRequest<FreightOrder>(`${BASE}/freight-orders/${id}`, { method: 'GET' });
}

export async function listFreightPullCandidates(
  params: { business_direction?: string; keyword?: string; skip?: number; limit?: number } = {},
) {
  return apiRequest<{ items: FreightPullCandidate[]; total: number }>(`${BASE}/freight-orders/pull-candidates`, {
    method: 'GET',
    params,
  });
}

export async function createFreightOrder(data: Record<string, unknown>) {
  return apiRequest<FreightOrder>(`${BASE}/freight-orders`, { method: 'POST', data });
}

export async function deleteFreightOrder(id: number) {
  return apiRequest<void>(`${BASE}/freight-orders/${id}`, { method: 'DELETE' });
}

export async function dispatchFreightOrder(id: number) {
  return apiRequest<FreightOrder>(`${BASE}/freight-orders/${id}/dispatch`, { method: 'POST' });
}

export async function shipFreightOrder(id: number) {
  return apiRequest<FreightOrder>(`${BASE}/freight-orders/${id}/ship`, { method: 'POST' });
}

export async function arriveFreightOrder(id: number) {
  return apiRequest<FreightOrder>(`${BASE}/freight-orders/${id}/arrive`, { method: 'POST' });
}

export async function signFreightOrder(id: number, data: Record<string, unknown>) {
  return apiRequest<FreightOrder>(`${BASE}/freight-orders/${id}/sign-receipt`, { method: 'POST', data });
}

export async function addFreightTrackingEvent(id: number, data: Record<string, unknown>) {
  return apiRequest<FreightOrder>(`${BASE}/freight-orders/${id}/tracking-events`, { method: 'POST', data });
}

export async function listFreightBills(params: ListParams & { review_status?: string } = {}) {
  return apiRequest<{ items: FreightBill[]; total: number }>(`${BASE}/freight-bills`, { method: 'GET', params });
}

export async function createFreightBill(data: Record<string, unknown>) {
  return apiRequest<FreightBill>(`${BASE}/freight-bills`, { method: 'POST', data });
}

export async function deleteFreightBill(id: number) {
  return apiRequest<void>(`${BASE}/freight-bills/${id}`, { method: 'DELETE' });
}

export async function listPendingFreightOrdersForBill(params: { carrier_id?: number } = {}) {
  return apiRequest<{ items: FreightOrder[]; total: number }>(`${BASE}/freight-bills/pending-freight-orders`, {
    method: 'GET',
    params,
  });
}

export async function trackLogistics(carrier: string, trackingNumber: string) {
  return apiRequest<Record<string, unknown>>('/core/logistics/track', {
    method: 'GET',
    params: { carrier, tracking_number: trackingNumber },
  });
}
