/**
 * 安装执行单 API
 */

import { apiRequest } from '../../../services/api';

export type InstallExecutionStatus = '待派工' | '进行中' | '待验收' | '已关闭';
export type InstallSupplySource = '自制' | '外购' | '混合';
export type InstallStageStatus = '待开始' | '进行中' | '已完成';
export type InstallTaskStatus = '待处理' | '进行中' | '已完成';
export type InstallCostType = '人工' | '差旅' | '外协' | '物料';

export const INSTALL_JOB_STATUSES: InstallExecutionStatus[] = ['待派工', '进行中', '待验收', '已关闭'];
export const INSTALL_SUPPLY_SOURCES: InstallSupplySource[] = ['自制', '外购', '混合'];
export const INSTALL_STAGE_STATUSES: InstallStageStatus[] = ['待开始', '进行中', '已完成'];
export const INSTALL_TASK_STATUSES: InstallTaskStatus[] = ['待处理', '进行中', '已完成'];
export const INSTALL_COST_TYPES: InstallCostType[] = ['人工', '差旅', '外协', '物料'];
export const MAX_TASK_ATTACHMENTS = 9;

export interface ActionCapability {
  allowed: boolean;
  reason?: string | null;
}

export interface InstallExecutionCapabilities {
  update?: ActionCapability;
  delete?: ActionCapability;
  close?: ActionCapability;
  assign_task?: ActionCapability;
  advance_stage?: ActionCapability;
  register_cost?: ActionCapability;
}

export interface InstallExecutionStage {
  id?: number;
  uuid?: string;
  job_id?: number;
  stage_key: string;
  stage_name: string;
  sort_order?: number;
  status: InstallStageStatus | string;
  planned_at?: string | null;
  actual_at?: string | null;
  notes?: string | null;
}

export interface InstallExecutionCost {
  id?: number;
  uuid?: string;
  job_id?: number;
  line_no?: number;
  cost_type: InstallCostType | string;
  amount: number | string;
  occurred_at: string;
  description?: string | null;
}

export interface InstallExecutionTask {
  id?: number;
  uuid?: string;
  job_id?: number;
  line_no?: number;
  stage_key: string;
  stage_name?: string | null;
  task_title: string;
  executor_id?: number | null;
  executor_name?: string | null;
  status: InstallTaskStatus | string;
  planned_at?: string | null;
  actual_at?: string | null;
  notes?: string | null;
  attachments?: DocumentAttachmentFile[] | null;
}

export interface DocumentAttachmentFile {
  uid?: string;
  name?: string;
  status?: string;
  url?: string;
}

export interface InstallExecution {
  id: number;
  uuid?: string;
  job_code: string;
  customer_id: number;
  customer_name: string;
  sales_order_id?: number | null;
  sales_order_code?: string | null;
  sales_delivery_id?: number | null;
  sales_delivery_code?: string | null;
  packing_binding_id?: number | null;
  supply_source: InstallSupplySource | string;
  site_address?: string | null;
  owner_id?: number | null;
  owner_name?: string | null;
  status: InstallExecutionStatus | string;
  current_stage_key?: string | null;
  notes?: string | null;
  total_cost_amount?: number | string | null;
  started_at?: string | null;
  closed_at?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by_name?: string | null;
  updated_by_name?: string | null;
  stages?: InstallExecutionStage[];
  costs?: InstallExecutionCost[];
  tasks?: InstallExecutionTask[];
  capabilities?: InstallExecutionCapabilities;
}

export interface InstallExecutionListResult {
  data: InstallExecution[];
  total: number;
  success: boolean;
}

export interface InstallExecutionListParams {
  skip?: number;
  limit?: number;
  customer_id?: number;
  status?: string;
  keyword?: string;
  sales_order_code?: string;
  order_by?: string;
}

export interface InstallExecutionStageInput {
  stage_key: string;
  status?: string;
  planned_at?: string;
  actual_at?: string;
  notes?: string;
}

export interface InstallExecutionCostInput {
  cost_type: string;
  amount: number;
  occurred_at: string;
  description?: string;
}

export interface InstallExecutionCreatePayload {
  customer_id: number;
  supply_source?: string;
  site_address?: string;
  owner_id?: number;
  owner_name?: string;
  notes?: string;
  sales_order_id?: number;
  sales_delivery_id?: number;
  packing_binding_id?: number;
  stages?: InstallExecutionStageInput[];
  costs?: InstallExecutionCostInput[];
}

export interface InstallExecutionUpdatePayload extends Partial<InstallExecutionCreatePayload> {
  status?: string;
}

export interface InstallExecutionTaskPayload {
  stage_key: string;
  task_title: string;
  executor_id?: number;
  executor_name?: string;
  status?: string;
  planned_at?: string;
  actual_at?: string;
  notes?: string;
  attachments?: DocumentAttachmentFile[];
}

export interface InstallExecutionAdvanceStagePayload {
  notes?: string;
}

export const installExecutionApi = {
  list: (params?: InstallExecutionListParams) =>
    apiRequest<InstallExecutionListResult>('/apps/kuaizhizao/install-executions', {
      method: 'GET',
      params,
    }),

  get: (id: number) =>
    apiRequest<InstallExecution>(`/apps/kuaizhizao/install-executions/${id}`, { method: 'GET' }),

  create: (data: InstallExecutionCreatePayload) =>
    apiRequest<InstallExecution>('/apps/kuaizhizao/install-executions', { method: 'POST', data }),

  update: (id: number, data: InstallExecutionUpdatePayload) =>
    apiRequest<InstallExecution>(`/apps/kuaizhizao/install-executions/${id}`, {
      method: 'PUT',
      data,
    }),

  close: (id: number, data?: { notes?: string }) =>
    apiRequest<InstallExecution>(`/apps/kuaizhizao/install-executions/${id}/close`, {
      method: 'POST',
      data: data ?? {},
    }),

  registerTask: (id: number, data: InstallExecutionTaskPayload) =>
    apiRequest<InstallExecution>(`/apps/kuaizhizao/install-executions/${id}/tasks`, {
      method: 'POST',
      data,
    }),

  advanceStage: (id: number, data?: InstallExecutionAdvanceStagePayload) =>
    apiRequest<InstallExecution>(`/apps/kuaizhizao/install-executions/${id}/advance-stage`, {
      method: 'POST',
      data: data ?? {},
    }),

  appendCost: (id: number, data: InstallExecutionCostInput) =>
    apiRequest<InstallExecution>(`/apps/kuaizhizao/install-executions/${id}/costs`, {
      method: 'POST',
      data,
    }),

  delete: (id: number) =>
    apiRequest(`/apps/kuaizhizao/install-executions/${id}`, { method: 'DELETE' }),

  pullFromSalesOrder: (data: { sales_order_id: number; supply_source?: string; site_address?: string }) =>
    apiRequest<InstallExecution>('/apps/kuaizhizao/install-executions/pull-from-sales-order', {
      method: 'POST',
      data,
    }),

  pullFromSalesDelivery: (data: {
    sales_delivery_id: number;
    supply_source?: string;
    site_address?: string;
    packing_binding_id?: number;
  }) =>
    apiRequest<InstallExecution>('/apps/kuaizhizao/install-executions/pull-from-sales-delivery', {
      method: 'POST',
      data,
    }),
};
