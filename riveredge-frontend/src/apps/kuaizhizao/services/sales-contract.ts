/**

 * 销售合同 API

 */



import { apiRequest } from '../../../services/api';

import type { BackendLifecycle } from '../utils/backendLifecycle';



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

  customer_id?: number;

  customer_name?: string;

  customer_contact?: string;

  customer_phone?: string;

  contract_date?: string;

  valid_from?: string;

  valid_to?: string;

  total_quantity?: number;

  total_amount?: number;

  released_quantity?: number;

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

  salesman_name?: string;

  notes?: string;

  items?: SalesContractItem[];

  milestones?: SalesContractMilestone[];

  lifecycle?: BackendLifecycle;

  created_at?: string;

  updated_at?: string;

}



export interface SalesContractAlert {

  alert_type: string;

  contract_id: number;

  contract_code: string;

  customer_name: string;

  message: string;

  severity: string;

  due_date?: string;

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



const BASE = '/apps/kuaizhizao/sales-contracts';



export const salesContractApi = {

  list: (params?: Record<string, unknown>) =>

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



  convertToOrder: (id: number, payload?: ConvertToOrderPayload | null) =>

    apiRequest<{ sales_order: Record<string, unknown>; contract: SalesContract }>(

      `${BASE}/${id}/convert-to-order`,

      { method: 'POST', data: payload ?? {} },

    ),



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

};



export default salesContractApi;


