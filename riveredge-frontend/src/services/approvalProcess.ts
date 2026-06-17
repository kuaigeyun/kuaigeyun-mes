/**
 * 审批流程管理服务
 * 
 * 提供审批流程的 CRUD 操作。
 * 注意：所有 API 自动过滤当前组织的审批流程
 */

import { apiRequest } from './api';

export interface ApprovalProcess {
  uuid: string;
  tenant_id: number;
  name: string;
  code: string;
  description?: string;
  nodes: Record<string, any>;
  config: Record<string, any>;
  draft_nodes?: Record<string, any> | null;
  version?: number;
  published_version?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApprovalProcessListParams {
  skip?: number;
  limit?: number;
  is_active?: boolean;
  /** 配置中心审核设置：返回全部审核开关流程（不受已安装应用过滤） */
  for_audit_config?: boolean;
}

export interface CreateApprovalProcessData {
  name: string;
  code: string;
  description?: string;
  nodes: Record<string, any>;
  config: Record<string, any>;
  is_active?: boolean;
}

export interface UpdateApprovalProcessData {
  name?: string;
  description?: string;
  nodes?: Record<string, any>;
  config?: Record<string, any>;
  is_active?: boolean;
}

/**
 * 获取审批流程列表
 */
export async function getApprovalProcessList(params?: ApprovalProcessListParams): Promise<ApprovalProcess[]> {
  return apiRequest<ApprovalProcess[]>('/core/approval-processes', {
    params,
  });
}

/**
 * 获取审批流程详情
 */
export async function getApprovalProcessByUuid(approvalProcessUuid: string): Promise<ApprovalProcess> {
  return apiRequest<ApprovalProcess>(`/core/approval-processes/${approvalProcessUuid}`);
}

/**
 * 创建审批流程
 */
export async function createApprovalProcess(data: CreateApprovalProcessData): Promise<ApprovalProcess> {
  return apiRequest<ApprovalProcess>('/core/approval-processes', {
    method: 'POST',
    data,
  });
}

export async function getConditionFields(entityType: string): Promise<{ fields: Array<{ field: string; label: string; type: string; operators: string[] }> }> {
  return apiRequest(`/core/approval-processes/condition-fields`, { params: { entity_type: entityType } });
}

/**
 * 更新审批流程
 */
export async function updateApprovalProcess(approvalProcessUuid: string, data: UpdateApprovalProcessData): Promise<ApprovalProcess> {
  return apiRequest<ApprovalProcess>(`/core/approval-processes/${approvalProcessUuid}`, {
    method: 'PUT',
    data,
  });
}

export async function publishApprovalProcess(approvalProcessUuid: string): Promise<ApprovalProcess> {
  return apiRequest<ApprovalProcess>(`/core/approval-processes/${approvalProcessUuid}/publish`, {
    method: 'POST',
  });
}

/**
 * 删除审批流程
 */
export async function deleteApprovalProcess(approvalProcessUuid: string): Promise<void> {
  return apiRequest<void>(`/core/approval-processes/${approvalProcessUuid}`, {
    method: 'DELETE',
  });
}

