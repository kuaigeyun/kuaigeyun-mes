/**
 * 报价单管理API服务
 *
 * 提供报价单相关的API调用接口。
 *
 * @author RiverEdge Team
 * @date 2026-02-19
 */

import { apiRequest } from '../../../services/api';

export interface QuotationItem {
  id?: number;
  uuid?: string;
  tenant_id?: number;
  quotation_id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  material_unit?: string;
  quote_quantity?: number;
  unit_price?: number;
  total_amount?: number;
  delivery_date?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Quotation {
  id?: number;
  uuid?: string;
  tenant_id?: number;
  quotation_code?: string;
  quotation_date?: string;
  valid_until?: string;
  delivery_date?: string;
  customer_id?: number;
  customer_name?: string;
  customer_contact?: string;
  customer_phone?: string;
  total_quantity?: number;
  total_amount?: number;
  status?: string;
  reviewer_id?: number;
  reviewer_name?: string;
  review_time?: string;
  review_status?: string;
  review_remarks?: string;
  salesman_id?: number;
  salesman_name?: string;
  shipping_address?: string;
  shipping_method?: string;
  payment_terms?: string;
  sales_order_id?: number;
  sales_order_code?: string;
  notes?: string;
  is_active?: boolean;
  created_by?: number;
  updated_by?: number;
  created_at?: string;
  updated_at?: string;
  items?: QuotationItem[];
}

export interface QuotationListParams {
  skip?: number;
  limit?: number;
  status?: string;
  start_date?: string;
  end_date?: string;
}

export interface QuotationListResponse {
  data: Quotation[];
  total: number;
  success: boolean;
}

export async function listQuotations(params: QuotationListParams = {}): Promise<QuotationListResponse> {
  return apiRequest<QuotationListResponse>('/apps/kuaizhizao/quotations', {
    method: 'GET',
    params,
  });
}

export async function getQuotation(id: number, includeItems: boolean = true): Promise<Quotation> {
  return apiRequest<Quotation>(`/apps/kuaizhizao/quotations/${id}`, {
    method: 'GET',
    params: { include_items: includeItems },
  });
}

export async function createQuotation(data: Partial<Quotation>): Promise<Quotation> {
  return apiRequest<Quotation>('/apps/kuaizhizao/quotations', {
    method: 'POST',
    data,
  });
}

export async function updateQuotation(id: number, data: Partial<Quotation>): Promise<Quotation> {
  return apiRequest<Quotation>(`/apps/kuaizhizao/quotations/${id}`, {
    method: 'PUT',
    data,
  });
}

export async function deleteQuotation(id: number): Promise<void> {
  return apiRequest<void>(`/apps/kuaizhizao/quotations/${id}`, {
    method: 'DELETE',
  });
}

export interface ConvertToOrderResponse {
  sales_order: { id?: number; order_code?: string; [key: string]: any };
  quotation: Quotation;
}

export async function convertQuotationToOrder(quotationId: number): Promise<ConvertToOrderResponse> {
  return apiRequest<ConvertToOrderResponse>(`/apps/kuaizhizao/quotations/${quotationId}/convert-to-order`, {
    method: 'POST',
  });
}
