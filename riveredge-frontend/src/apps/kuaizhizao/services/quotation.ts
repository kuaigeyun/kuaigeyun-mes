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
  /** 币种（数据字典 CURRENCY，默认 CNY 人民币） */
  currency_code?: string;
  sales_order_id?: number;
  sales_order_code?: string;
  /** 报价系列编码（首版通常与 quotation_code 相同） */
  quotation_series_code?: string;
  root_quotation_id?: number;
  version_no?: number;
  previous_quotation_id?: number;
  is_latest_in_series?: boolean;
  superseded_by_id?: number;
  formal_document_generated_at?: string;
  /** 已转单但下游销售订单已不存在（如已删除） */
  conversion_downstream_missing?: boolean;
  notes?: string;
  is_active?: boolean;
  created_by?: number;
  updated_by?: number;
  created_at?: string;
  updated_at?: string;
  items?: QuotationItem[];
  lifecycle?: Record<string, unknown>;
}

export interface QuotationListParams {
  skip?: number;
  limit?: number;
  status?: string;
  salesman_id?: number;
  start_date?: string;
  end_date?: string;
  /** 工具栏模糊搜索：编号、客户 */
  keyword?: string;
  quotation_code?: string;
  customer_name?: string;
  quotation_series_code?: string;
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

/** 提交报价单（草稿 → 已发送；蓝图无需审核时自动通过） */
export async function submitQuotation(id: number): Promise<Quotation> {
  return apiRequest<Quotation>(`/apps/kuaizhizao/quotations/${id}/submit`, {
    method: 'POST',
  });
}

/** 撤回报价单（已发送 + 待审核 → 草稿） */
export async function withdrawQuotation(id: number): Promise<Quotation> {
  return apiRequest<Quotation>(`/apps/kuaizhizao/quotations/${id}/withdraw`, {
    method: 'POST',
  });
}

/** 审核通过（已发送 + 待审核 → 保持已发送，审核通过） */
export async function approveQuotation(id: number, data?: { review_remarks?: string }): Promise<Quotation> {
  return apiRequest<Quotation>(`/apps/kuaizhizao/quotations/${id}/approve`, {
    method: 'POST',
    data: data ?? {},
  });
}

/** 驳回（已发送 + 待审核 → 已拒绝） */
export async function rejectQuotation(id: number, data?: { review_remarks?: string }): Promise<Quotation> {
  return apiRequest<Quotation>(`/apps/kuaizhizao/quotations/${id}/reject`, {
    method: 'POST',
    data: data ?? {},
  });
}

/** 撤回审核（已发送 + 已通过 → 待审核） */
export async function revokeReviewQuotation(id: number): Promise<Quotation> {
  return apiRequest<Quotation>(`/apps/kuaizhizao/quotations/${id}/revoke-review`, {
    method: 'POST',
  });
}

/** 客户确认 / 标记已接受（已发送 + 已通过 → 已接受） */
export async function confirmCustomerQuotation(id: number): Promise<Quotation> {
  return apiRequest<Quotation>(`/apps/kuaizhizao/quotations/${id}/confirm-customer`, {
    method: 'POST',
  });
}

/** 驳回后重新编辑（已拒绝 → 草稿） */
export async function reopenQuotation(id: number): Promise<Quotation> {
  return apiRequest<Quotation>(`/apps/kuaizhizao/quotations/${id}/reopen`, {
    method: 'POST',
  });
}

/** 撤回下推（已转订单且下游销售订单已不存在 → 已接受） */
export async function revokePushQuotation(id: number): Promise<Quotation> {
  return apiRequest<Quotation>(`/apps/kuaizhizao/quotations/${id}/revoke-push`, {
    method: 'POST',
  });
}

/** 另存为新版本（修订）：从系列当前最新版复制为草稿 */
export async function createQuotationRevision(
  quotationId: number,
  data?: Record<string, unknown>
): Promise<Quotation> {
  return apiRequest<Quotation>(`/apps/kuaizhizao/quotations/${quotationId}/revision`, {
    method: 'POST',
    data: data ?? {},
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

