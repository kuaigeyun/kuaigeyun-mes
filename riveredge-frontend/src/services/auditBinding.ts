/**
 * 审核单据绑定（配置中心审核设置）
 */

import { apiRequest } from './api';

export interface AuditBindingItem {
  node_key: string;
  entity_type: string;
  resource: string;
  name: string;
  app: string;
  config_category: string;
  template: string;
  is_enabled: boolean;
  process_uuid?: string | null;
  process_name?: string | null;
  process_code?: string | null;
  process_matched?: boolean;
}

export interface AuditProcessOption {
  uuid: string;
  name: string;
  code: string;
  is_active: boolean;
}

export interface AuditBindingListResponse {
  items: AuditBindingItem[];
  process_options: AuditProcessOption[];
}

export interface AuditBindingUpdatePayload {
  is_enabled?: boolean;
  process_uuid?: string | null;
}

export async function getAuditBindings(): Promise<AuditBindingListResponse> {
  return apiRequest<AuditBindingListResponse>('/core/audit-bindings');
}

export async function updateAuditBinding(
  nodeKey: string,
  data: AuditBindingUpdatePayload,
): Promise<{ node_key: string; is_enabled: boolean; process_uuid?: string | null }> {
  return apiRequest(`/core/audit-bindings/${encodeURIComponent(nodeKey)}`, {
    method: 'PUT',
    data,
  });
}
