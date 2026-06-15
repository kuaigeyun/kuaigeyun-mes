/**
 * 审批实例管理服务
 * 
 * 提供审批实例的 CRUD 操作和审批操作功能。
 * 注意：所有 API 自动过滤当前组织的审批实例
 */

import { apiRequest } from './api';

export interface ApprovalInstance {
  uuid: string;
  tenant_id: number;
  process_uuid: string;
  title: string;
  content?: string;
  data?: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  current_node?: string;
  current_approver_id?: number;
  inngest_run_id?: string;
  submitter_id: number;
  submitted_at: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ApprovalInstanceListParams {
  skip?: number;
  limit?: number;
  status?: string;
  submitter_id?: number;
  current_approver_id?: number;
}

export interface CreateApprovalInstanceData {
  process_uuid: string;
  title: string;
  content?: string;
  data?: Record<string, any>;
}

export interface UpdateApprovalInstanceData {
  title?: string;
  content?: string;
  data?: Record<string, any>;
  status?: string;
  current_node?: string;
  current_approver_id?: number;
}

export interface ApprovalInstanceActionData {
  action: 'approve' | 'reject' | 'cancel' | 'transfer';
  comment?: string;
  transfer_to_user_id?: number;
}

/**
 * 按 entity 获取审批状态（统一入口，供 UniApprovalPanel 等使用）
 */
export interface ApprovalProcessGraph {
  nodes?: Array<{
    id: string;
    type?: string;
    position?: { x: number; y: number };
    data?: Record<string, unknown>;
  }>;
  edges?: Array<{ id?: string; source: string; target: string }>;
}

export interface ApprovalProcessBrief {
  uuid: string;
  name: string;
  code: string;
  nodes: ApprovalProcessGraph;
}

export interface ApprovalInstanceBrief {
  uuid: string;
  submitter_id: number;
  submitter_name: string;
  submitted_at?: string | null;
  title?: string;
}

export interface ApprovalNodeExecution {
  action?: string;
  action_label?: string;
  action_by?: number;
  action_by_name?: string;
  action_at?: string | null;
  comment?: string | null;
  from_node?: string | null;
  to_node?: string | null;
  source?: string;
  field_changes?: Array<{ field?: string; label?: string; from?: string; to?: string }>;
}

export interface ApprovalNodeOverview {
  node_id: string;
  label: string;
  node_type: string;
  is_current: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'waiting' | 'skipped' | string;
  eligible_approvers: Array<{ user_id: number; name: string }>;
  executions: ApprovalNodeExecution[];
}

export interface ApprovalStatusResponse {
  has_flow: boolean;
  has_instance?: boolean;
  status?: string;
  current_node?: string;
  current_approver_id?: number;
  process?: ApprovalProcessBrief | null;
  instance?: ApprovalInstanceBrief | null;
  nodes_overview?: ApprovalNodeOverview[];
  can_edit_during_approval?: boolean;
  editable_fields?: string[] | '*';
  node_capabilities?: {
    allow_transfer?: boolean;
    allow_add_sign?: boolean;
    allow_edit_during_approval?: boolean;
  };
  tasks?: Array<{
    uuid: string;
    node_id?: string;
    approver_id?: number;
    status?: string;
    action_at?: string;
    comment?: string;
  }>;
  history?: Array<{
    action?: string;
    action_by?: number;
    action_by_name?: string;
    action_at?: string;
    comment?: string;
    from_node?: string;
    to_node?: string;
  }>;
}

export async function getApprovalStatus(
  entityType: string,
  entityId: number,
): Promise<ApprovalStatusResponse> {
  return apiRequest<ApprovalStatusResponse>('/core/approval-instances/status', {
    params: { entity_type: entityType, entity_id: entityId },
  });
}

/**
 * 获取审批实例列表
 */
export async function getApprovalInstanceList(params?: ApprovalInstanceListParams): Promise<ApprovalInstance[]> {
  return apiRequest<ApprovalInstance[]>('/core/approval-instances', {
    params,
  });
}

/**
 * 获取审批实例详情
 */
export async function getApprovalInstanceByUuid(approvalInstanceUuid: string): Promise<ApprovalInstance> {
  return apiRequest<ApprovalInstance>(`/core/approval-instances/${approvalInstanceUuid}`);
}

/**
 * 创建审批实例（提交审批）
 */
export async function createApprovalInstance(data: CreateApprovalInstanceData): Promise<ApprovalInstance> {
  return apiRequest<ApprovalInstance>('/core/approval-instances', {
    method: 'POST',
    data,
  });
}

/**
 * 更新审批实例
 */
export async function updateApprovalInstance(approvalInstanceUuid: string, data: UpdateApprovalInstanceData): Promise<ApprovalInstance> {
  return apiRequest<ApprovalInstance>(`/core/approval-instances/${approvalInstanceUuid}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除审批实例
 */
export async function deleteApprovalInstance(approvalInstanceUuid: string): Promise<void> {
  return apiRequest<void>(`/core/approval-instances/${approvalInstanceUuid}`, {
    method: 'DELETE',
  });
}

/**
 * 执行审批操作（同意、拒绝、取消、转交）
 */
export async function performApprovalAction(approvalInstanceUuid: string, action: ApprovalInstanceActionData): Promise<ApprovalInstance> {
  return apiRequest<ApprovalInstance>(`/core/approval-instances/${approvalInstanceUuid}/action`, {
    method: 'POST',
    data: action,
  });
}

export interface ApprovalInstanceBatchActionData {
  instance_uuids: string[];
  action: 'approve' | 'reject';
  comment?: string;
}

export interface ApprovalInstanceBatchResult {
  success_count: number;
  failure_count: number;
  failures: Array<{ uuid: string; error: string }>;
}

export async function batchPerformApprovalActions(
  data: ApprovalInstanceBatchActionData,
): Promise<ApprovalInstanceBatchResult> {
  return apiRequest<ApprovalInstanceBatchResult>('/core/approval-instances/batch-action', {
    method: 'POST',
    data,
  });
}

