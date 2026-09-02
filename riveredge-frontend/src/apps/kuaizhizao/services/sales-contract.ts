/**

 * 销售合同 API

 */



import { apiRequest } from '../../../services/api';

import type { DocumentPrintApiResult } from '../../../utils/printResponseHelpers';

import type { BackendLifecycle } from '../utils/backendLifecycle';
import type { SalesContractTermSnapshot } from './sales-contract-term';



export interface SalesContractItem {

  id?: number;

  material_id: number;

  material_code: string;

  material_name: string;

  material_spec?: string;

  material_unit: string;

  contract_quantity: number;

  released_quantity?: number;

  unit_price: number;

  tax_rate?: number;

  total_amount: number;

  delivery_date?: string;

  notes?: string;

}



export interface SalesContractMilestone {

  id?: number;

  milestone_name: string;

  planned_date: string;

  planned_amount?: number;

  planned_ratio?: number;

  billing_trigger?: string;

  status?: string;

  receivable_id?: number;

  receivable_code?: string;

  notes?: string;

}



export interface SalesContract {

  id?: number;

  contract_code?: string;

  contract_type?: 'single' | 'framework' | string;

  /** 是否录入明细：false=金额总框（无产品行，手填总金额） */
  enter_line_items?: boolean;

  customer_id?: number;

  customer_name?: string;

  customer_contact?: string;

  customer_phone?: string;

  contract_date?: string;

  valid_from?: string;

  valid_to?: string;

  total_quantity?: number;

  total_amount?: number;

  /** 整单优惠金额（从价税合计扣减，不改明细单价） */
  discount_amount?: number;

  released_quantity?: number;

  released_sales_order_codes?: string[];

  released_amount?: number;

  remaining_quantity?: number;

  remaining_amount?: number;

  price_type?: string;

  currency_code?: string;

  status?: string;

  review_status?: string;

  quotation_id?: number;

  quotation_code?: string;

  payment_terms?: string;

  shipping_address?: string;

  shipping_method?: string;

  salesman_id?: number;

  salesman_name?: string;

  notes?: string;

  term_group_id?: number;

  term_group_name?: string;

  contract_terms?: SalesContractTermSnapshot[];

  items?: SalesContractItem[];

  milestones?: SalesContractMilestone[];

  lifecycle?: BackendLifecycle;

  capabilities?: SalesContractCapabilities;

  created_by?: number;

  created_by_name?: string;

  updated_by?: number;

  updated_by_name?: string;

  created_at?: string;

  updated_at?: string;

}

export interface ActionCapability {
  allowed: boolean;
  reason?: string | null;
}

export interface SalesContractCapabilities {
  update?: ActionCapability;
  delete?: ActionCapability;
  submit?: ActionCapability;
  withdraw_submit?: ActionCapability;
  approve?: ActionCapability;
  reject?: ActionCapability;
  revoke_approval?: ActionCapability;
  push_to_sales_order?: ActionCapability;
  push_to_work_order?: ActionCapability;
  print?: ActionCapability;
  close?: ActionCapability;
  create_change?: ActionCapability;
}



export interface SalesContractAlert {

  alert_type: string;

  contract_id: number;

  contract_code: string;

  customer_name: string;

  message: string;

  severity: string;

  due_date?: string;

  milestone_id?: number;

}



/** 合同预警 feed 行唯一 key（同一合同可有多条里程碑逾期） */
export function salesContractAlertFeedId(alert: SalesContractAlert): string {
  if (alert.milestone_id != null) {
    return `${alert.alert_type}-${alert.contract_id}-${alert.milestone_id}`;
  }
  if (alert.alert_type === 'milestone_overdue') {
    return `${alert.alert_type}-${alert.contract_id}-${alert.due_date ?? alert.message}`;
  }
  return `${alert.alert_type}-${alert.contract_id}`;
}



export interface SalesContractExecutionSummary {

  contract_id: number;

  contract_code: string;

  contract_type: string;

  customer_name: string;

  total_amount: number;

  released_amount: number;

  remaining_amount: number;

  valid_to?: string;

  status: string;

}



export interface SalesContractChange {

  id: number;

  change_code: string;

  contract_id: number;

  contract_code: string;

  change_type: string;

  status: string;

  review_status?: string;

  delta_amount: number;

  new_valid_to?: string;

  new_total_amount?: number;

  reason?: string;

  created_at?: string;

  updated_at?: string;

}



export interface SalesContractPaymentSummary {

  contract_id: number;

  contract_code: string;

  total_amount: number;

  planned_milestone_amount: number;

  invoiced_amount: number;

  collected_amount: number;

  pending_amount: number;

  milestones: Array<{

    id: number;

    milestone_name: string;

    planned_date?: string;

    planned_amount?: number;

    status?: string;

    receivable_id?: number;

    receivable_code?: string;

  }>;

}



export interface ConvertToOrderPayload {

  selected_item_ids?: number[];

  release_lines?: { item_id: number; release_quantity: number }[];

}

export interface PushToWorkOrderFromContractPayload {
  selected_item_ids?: number[];
  release_lines?: { item_id: number; release_quantity: number }[];
  push_mode?: 'draft' | 'confirm';
  work_order_granularity?: 'grouped' | 'peer_group';
}

export interface SalesContractPushPreviewItem {
  item_id: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_unit?: string;
  quantity: number;
  pushed_quantity: number;
  max_push_quantity: number;
  delivery_date?: string | null;
  blocking_issues?: string[];
  suggested_action?: string;
  source_type?: string;
}

export interface SalesContractPushPreviewResponse {
  target_type: 'sales_order' | 'work_order';
  summary: string;
  items: SalesContractPushPreviewItem[];
  has_blocking_issues?: boolean;
  blocking_reason?: string | null;
  push_mode_default?: 'draft' | 'confirm' | string;
  tip?: string;
}

export interface PullSalesContractFromQuotationResponse {
  success: boolean;
  message: string;
  source_type: 'quotation';
  source_id: number;
  sales_contract: SalesContract;
  quotation: {
    id?: number;
    quotation_code?: string;
    status?: string;
    [key: string]: any;
  };
}



export interface SalesContractListParams extends Record<string, unknown> {
  skip?: number;
  limit?: number;
  keyword?: string;
  contract_code?: string;
  status?: string;
  contract_type?: string;
  customer_id?: number;
  start_date?: string;
  end_date?: string;
  order_by?: string;
  /** 明细表格视图：附带合同明细 */
  include_items?: boolean;
}



const BASE = '/apps/kuaizhizao/sales-contracts';



export const salesContractApi = {

  list: (params?: SalesContractListParams) =>

    apiRequest<{ items: SalesContract[]; total: number }>(BASE, { params }),



  get: (id: number, includeItems = true) =>

    apiRequest<SalesContract>(`${BASE}/${id}`, { params: { include_items: includeItems } }),



  create: (data: Partial<SalesContract>, autoSubmit = false) =>

    apiRequest<SalesContract>(BASE, { method: 'POST', params: { auto_submit: autoSubmit }, data }),



  update: (id: number, data: Partial<SalesContract>) =>

    apiRequest<SalesContract>(`${BASE}/${id}`, { method: 'PUT', data }),



  remove: (id: number) => apiRequest(`${BASE}/${id}`, { method: 'DELETE' }),



  submit: (id: number) => apiRequest<SalesContract>(`${BASE}/${id}/submit`, { method: 'POST' }),



  approve: (id: number, review_remarks?: string) =>

    apiRequest<SalesContract>(`${BASE}/${id}/approve`, { method: 'POST', data: { review_remarks } }),



  reject: (id: number, review_remarks?: string) =>

    apiRequest<SalesContract>(`${BASE}/${id}/reject`, { method: 'POST', data: { review_remarks } }),



  close: (id: number, reason?: string) =>

    apiRequest<SalesContract>(`${BASE}/${id}/close`, { method: 'POST', data: { reason } }),



  convertFromQuotation: (quotationId: number, contractType = 'single') =>

    apiRequest<SalesContract>(`${BASE}/from-quotation/${quotationId}`, {

      method: 'POST',

      params: { contract_type: contractType },

    }),

  convertFromSalesOrder: (salesOrderId: number) =>
    apiRequest<SalesContract>(`${BASE}/from-sales-order/${salesOrderId}`, {
      method: 'POST',
    }),

  pullSalesContractFromQuotation: async (quotationId: number, contractType = 'single') => {
    const salesContract = await apiRequest<SalesContract>(`${BASE}/from-quotation/${quotationId}`, {
      method: 'POST',
      params: { contract_type: contractType },
    });
    return {
      success: true,
      message: '已从报价单创建销售合同',
      source_type: 'quotation' as const,
      source_id: quotationId,
      sales_contract: salesContract,
      quotation: { id: quotationId },
    } satisfies PullSalesContractFromQuotationResponse;
  },



  convertToOrder: (id: number, payload?: ConvertToOrderPayload | null) =>

    apiRequest<{ sales_order: Record<string, unknown>; contract: SalesContract }>(

      `${BASE}/${id}/convert-to-order`,

      { method: 'POST', data: payload ?? {} },

    ),

  previewPushToSalesOrder: (id: number) =>
    apiRequest<SalesContractPushPreviewResponse>(`${BASE}/${id}/push-to-sales-order/preview`, {
      method: 'GET',
    }),

  previewPushToWorkOrder: (id: number) =>
    apiRequest<SalesContractPushPreviewResponse>(`${BASE}/${id}/push-to-work-order/preview`, {
      method: 'GET',
    }),

  pushToWorkOrder: (id: number, payload?: PushToWorkOrderFromContractPayload | null) =>
    apiRequest<{
      success: boolean;
      message: string;
      target_documents?: { type: string; id: number; code: string }[];
    }>(`${BASE}/${id}/push-to-work-order`, { method: 'POST', data: payload ?? {} }),



  paymentSummary: (id: number) => apiRequest<SalesContractPaymentSummary>(`${BASE}/${id}/payment-summary`),



  listChanges: (contractId: number, params?: { skip?: number; limit?: number }) =>

    apiRequest<SalesContractChange[]>(`${BASE}/${contractId}/changes`, { params }),



  createChange: (contractId: number, data: Partial<SalesContractChange>) =>

    apiRequest<SalesContractChange>(`${BASE}/${contractId}/changes`, { method: 'POST', data }),



  submitChange: (changeId: number) =>

    apiRequest<SalesContractChange>(`${BASE}/changes/${changeId}/submit`, { method: 'POST' }),



  approveChange: (changeId: number) =>

    apiRequest<SalesContractChange>(`${BASE}/changes/${changeId}/approve`, { method: 'POST' }),



  rejectChange: (changeId: number) =>

    apiRequest<SalesContractChange>(`${BASE}/changes/${changeId}/reject`, { method: 'POST' }),



  generateMilestoneReceivable: (contractId: number, milestoneId: number) =>

    apiRequest(`${BASE}/${contractId}/milestones/${milestoneId}/generate-receivable`, { method: 'POST' }),



  listAlerts: () => apiRequest<SalesContractAlert[]>(`${BASE}/alerts`),



  executionSummary: () => apiRequest<SalesContractExecutionSummary[]>(`${BASE}/execution-summary`),

  withdraw: (id: number) =>
    apiRequest<SalesContract>(`${BASE}/${id}/withdraw`, { method: 'POST' }),

  revokeReview: (id: number) =>
    apiRequest<SalesContract>(`${BASE}/${id}/revoke-review`, { method: 'POST' }),

  print: (
    id: number,
    options?: {
      templateUuid?: string;
      outputFormat?: 'html' | 'pdf';
      responseFormat?: 'json' | 'html';
    },
  ) =>
    apiRequest<DocumentPrintApiResult>(
      `${BASE}/${id}/print`,
      {
        method: 'GET',
        params: {
          template_uuid: options?.templateUuid,
          output_format: options?.outputFormat ?? 'pdf',
          response_format: options?.responseFormat ?? 'json',
        },
      },
    ),

  getPrintVariables: (id: number) =>
    apiRequest<{ success: boolean; variables: Record<string, unknown> }>(
      `${BASE}/${id}/print-variables`,
      { method: 'GET' },
    ),
};



export default salesContractApi;


