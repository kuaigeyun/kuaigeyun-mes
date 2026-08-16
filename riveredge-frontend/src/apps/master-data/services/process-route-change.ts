/**
 * 工艺路线变更 API
 */

import { apiRequest } from '../../../services/api';

const BASE = '/apps/master-data/process';

export interface ProcessRouteChangeRecord {
  id?: number;
  uuid?: string;
  process_route_uuid?: string;
  process_route_id?: number;
  process_route_code?: string;
  process_route_name?: string;
  change_type?: string;
  change_content?: Record<string, unknown> | null;
  change_reason?: string | null;
  status?: string;
  applicant_name?: string | null;
  created_by_name?: string | null;
  updated_by_name?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ProcessRouteChangeCreatePayload {
  process_route_uuid: string;
  change_type: string;
  change_reason?: string;
  change_content?: Record<string, unknown>;
  status?: string;
}

export async function createProcessRouteChange(data: ProcessRouteChangeCreatePayload) {
  return apiRequest<ProcessRouteChangeRecord>(`${BASE}/routes/changes`, { method: 'POST', data });
}

export async function getProcessRouteChange(changeUuid: string) {
  return apiRequest<ProcessRouteChangeRecord>(`${BASE}/routes/changes/${changeUuid}`, {
    method: 'GET',
  });
}

export async function listProcessRouteChanges(params?: {
  process_route_uuid?: string;
  status?: string;
  page?: number;
  page_size?: number;
}) {
  const res = await apiRequest<{ items?: ProcessRouteChangeRecord[]; total?: number }>(
    `${BASE}/routes/changes`,
    { method: 'GET', params },
  );
  return {
    items: res.items ?? [],
    total: res.total ?? 0,
  };
}
