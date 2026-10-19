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
  operation_sequence?: number;
  operation_code?: string | null;
  operation_name?: string | null;
  flow_mode?: string | null;
  note?: string | null;
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
  process_operations?: Array<{
    code?: string | null;
    name?: string | null;
    sequence?: number;
    allow_jump?: boolean;
    standard_time?: number | null;
    setup_time?: number | null;
  }>;
  process_material_code?: string | null;
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
  skipped_count?: number;
}

export type FlowJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface FlowGenerateJob {
  job_id: string;
  status: FlowJobStatus;
  progress: number;
  message?: string | null;
  result?: FlowExecuteResult | null;
  error?: string | null;
  created_at?: string;
  updated_at?: string;
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

/** 启动异步造数任务（立即返回 job_id，避免网关 504） */
export async function startFlowGenerate(
  body: FlowGeneratePayload,
): Promise<FlowGenerateJob> {
  return apiRequest(BASE, {
    method: 'POST',
    data: body,
    timeoutMs: 60_000,
  });
}

export async function getFlowGenerateJob(jobId: string): Promise<FlowGenerateJob> {
  return apiRequest(`${BASE}/jobs/${encodeURIComponent(jobId)}`, {
    method: 'GET',
    timeoutMs: 30_000,
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 启动并轮询至完成；onProgress 用于进度条 */
export async function executeFlowGenerate(
  body: FlowGeneratePayload,
  onProgress?: (job: FlowGenerateJob) => void,
): Promise<FlowExecuteResult> {
  const started = await startFlowGenerate(body);
  onProgress?.(started);
  let job = started;
  const deadline = Date.now() + 30 * 60_000;
  while (job.status === 'queued' || job.status === 'running') {
    if (Date.now() > deadline) {
      throw new Error('造数任务超时，请稍后在业务单据中核对是否已生成');
    }
    await sleep(1200);
    job = await getFlowGenerateJob(job.job_id);
    onProgress?.(job);
  }
  if (job.status === 'failed') {
    throw new Error(job.error || job.message || '造数未通过，请修改后重试');
  }
  if (!job.result) {
    throw new Error('造数任务已完成但未返回结果');
  }
  return job.result;
}
