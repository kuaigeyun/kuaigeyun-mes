/**
 * 流程造数：按销售订单/销售预测生成制造全流程数据
 */

import { apiRequest } from '../../../services/api';

export type FlowSourceType = 'sales_order' | 'sales_forecast';

export type StepOperatorMode =
  | 'fixed'
  | 'random_role'
  | 'random_department'
  | 'random_team'
  | 'operation_assigned'
  | 'current';

export interface FlowEligibleOrder {
  id: number;
  order_code: string;
  order_name?: string | null;
  customer_name?: string | null;
  status?: string;
  order_date?: string | null;
  planning_pushed_to_computation?: boolean;
  eligible?: boolean;
  block_reason?: string | null;
}

export interface FlowEligibleForecast {
  id: number;
  forecast_code: string;
  forecast_name?: string | null;
  forecast_period?: string | null;
  status?: string;
  start_date?: string | null;
  end_date?: string | null;
  planning_pushed_to_computation?: boolean;
  eligible?: boolean;
  block_reason?: string | null;
}

export interface FlowInterval {
  min_seconds: number;
  max_seconds: number;
}

export interface FlowWorkSchedule {
  weekdays: number[];
  start_time: string;
  end_time: string;
  lookback_days?: number;
}

export interface StepOperatorPayload {
  mode: StepOperatorMode;
  user_id?: number | null;
  role_code?: string | null;
  department_id?: number | null;
  work_group_id?: number | null;
}

export interface ReportingBatchConfig {
  min_batches: number;
  max_batches: number;
}

export interface FlowGeneratePayload {
  source_type: FlowSourceType;
  sales_order_id?: number | null;
  sales_forecast_id?: number | null;
  warehouse_id?: number | null;
  anchor_at?: string | null;
  default_interval?: FlowInterval;
  intervals?: Record<string, FlowInterval>;
  steps?: Record<string, boolean>;
  step_operators?: Record<string, StepOperatorPayload>;
  reporting_batches?: ReportingBatchConfig;
  work_schedule?: FlowWorkSchedule | null;
  use_work_schedule?: boolean;
}

export interface FlowOperatorDefaultStep {
  step_key: string;
  default_role_codes: string[];
}

export interface FlowOperatorDefaultsResult {
  steps: FlowOperatorDefaultStep[];
}

export interface FlowPreviewStep {
  step_key: string;
  label: string;
  issued_at: string;
}

export interface FlowPreviewResult {
  source_type?: FlowSourceType;
  sales_order_id?: number | null;
  sales_forecast_id?: number | null;
  order_code: string;
  warehouse_id: number;
  warehouse_name: string;
  anchor_at: string;
  steps: FlowPreviewStep[];
  warnings?: string[];
}

export interface FlowStepResult {
  step_key: string;
  status: string;
  doc_type?: string;
  doc_id?: number;
  doc_code?: string;
  label?: string;
  issued_at?: string;
  operation_log_id?: number | null;
  note?: string | null;
  message?: string;
}

export interface FlowExecuteResult {
  success: boolean;
  run_id: string;
  source_type?: FlowSourceType;
  sales_order_id?: number | null;
  sales_forecast_id?: number | null;
  order_code: string;
  warehouse_id: number;
  warehouse_name: string;
  steps: FlowStepResult[];
  timeline: FlowStepResult[];
  outsource_notes?: string[];
  operators?: Record<string, number>;
  errors?: string[];
}

const BASE = '/apps/kuaizhizao/management/flow-generate';

export async function getFlowOperatorDefaults(): Promise<FlowOperatorDefaultsResult> {
  return apiRequest(BASE + '/operator-defaults', {
    method: 'GET',
  });
}

export async function previewFlowGenerate(
  body: FlowGeneratePayload,
): Promise<FlowPreviewResult> {
  return apiRequest(BASE + '/preview', {
    method: 'POST',
    data: body,
    timeoutMs: 60_000,
  });
}

export async function executeFlowGenerate(
  body: FlowGeneratePayload,
): Promise<FlowExecuteResult> {
  return apiRequest(BASE, {
    method: 'POST',
    data: body,
    timeoutMs: 300_000,
  });
}
