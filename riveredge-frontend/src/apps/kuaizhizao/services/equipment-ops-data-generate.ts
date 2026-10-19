/**
 * 设备点检 / 保养执行造数 API（按点检单模板 / 保养计划）
 */

import { apiRequest } from '../../../services/api';

export type EquipmentOpsOperatorMode =
  | 'equipment_assigned'
  | 'scheme_assigned'
  | 'fixed'
  | 'random_role'
  | 'random_department'
  | 'random_team'
  | 'current';

export interface EquipmentOpsWorkSchedule {
  weekdays: number[];
  start_time: string;
  end_time: string;
  lookback_days?: number;
}

export interface EquipmentOpsOperatorPayload {
  mode: EquipmentOpsOperatorMode;
  user_id?: number | null;
  role_code?: string | null;
  department_id?: number | null;
  work_group_id?: number | null;
}

export interface EquipmentOpsGeneratePayload {
  spot_check_ids: number[];
  maintenance_plan_ids: number[];
  equipment_ids: number[];
  anchor_start: string;
  anchor_end: string;
  use_work_schedule: boolean;
  work_schedule?: EquipmentOpsWorkSchedule | null;
  auto_approve_spot_check: boolean;
  inspector_operator: EquipmentOpsOperatorPayload;
  approver_operator: EquipmentOpsOperatorPayload;
}

export interface EquipmentOpsBoundEquipmentItem {
  id: number;
  code?: string | null;
  name?: string | null;
}

export interface EquipmentOpsBoundEquipmentResult {
  equipment: EquipmentOpsBoundEquipmentItem[];
  notes?: string[];
}

export interface EquipmentOpsPreviewResult {
  ok?: boolean;
  equipment_count: number;
  spot_check_seed_count?: number;
  maintenance_plan_count?: number;
  spot_check_targets: number;
  maintenance_targets: number;
  spot_check_docs: number;
  maintenance_docs: number;
  anchor_start?: string;
  anchor_end?: string;
  notes?: string[];
  errors?: string[];
  runtime_approx_plans?: string[];
  operator_fallback_steps?: string[];
  skipped_bc_count?: number;
}

export interface EquipmentOpsCreatedDoc {
  doc_type: string;
  doc_id: number;
  doc_code: string;
  equipment_id?: number;
  equipment_code?: string;
  status?: string;
  check_date?: string;
  plan_no?: string;
}

export interface EquipmentOpsExecuteResult {
  success: boolean;
  run_id: string;
  created: EquipmentOpsCreatedDoc[];
  created_count: number;
  errors?: string[];
  notes?: string[];
  preview?: {
    equipment_count: number;
    spot_check_docs: number;
    maintenance_docs: number;
  };
}

const BASE = '/apps/kuaizhizao/management/equipment-ops-generate';

export async function listEquipmentOpsBoundEquipment(
  body: Pick<
    EquipmentOpsGeneratePayload,
    'spot_check_ids' | 'maintenance_plan_ids'
  >,
): Promise<EquipmentOpsBoundEquipmentResult> {
  return apiRequest(BASE + '/bound-equipment', {
    method: 'POST',
    data: {
      ...body,
      equipment_ids: [],
      anchor_start: new Date().toISOString(),
      anchor_end: new Date().toISOString(),
      use_work_schedule: false,
      auto_approve_spot_check: false,
      inspector_operator: { mode: 'current' },
      approver_operator: { mode: 'current' },
    },
    timeoutMs: 60_000,
  });
}

export async function previewEquipmentOpsGenerate(
  body: EquipmentOpsGeneratePayload,
): Promise<EquipmentOpsPreviewResult> {
  return apiRequest(BASE + '/preview', {
    method: 'POST',
    data: body,
    timeoutMs: 60_000,
  });
}

export async function executeEquipmentOpsGenerate(
  body: EquipmentOpsGeneratePayload,
): Promise<EquipmentOpsExecuteResult> {
  return apiRequest(BASE, {
    method: 'POST',
    data: body,
    timeoutMs: 300_000,
  });
}
