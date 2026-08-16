/**
 * BOM 工程变更（ECN）API
 */

import { apiRequest } from '../../../services/api';

const BASE = '/apps/master-data/materials';

export interface BomChangeRecord {
  id?: number;
  uuid?: string;
  material_uuid?: string;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  change_type?: string;
  change_content?: Record<string, unknown> | null;
  change_reason?: string | null;
  change_impact?: Record<string, unknown> | null;
  status?: string;
  bom_code?: string | null;
  from_version?: string | null;
  to_version?: string | null;
  applicant_name?: string | null;
  created_by_name?: string | null;
  updated_by_name?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface BomChangeCreatePayload {
  material_uuid: string;
  change_type: string;
  change_reason?: string;
  change_content?: Record<string, unknown>;
  change_impact?: Record<string, unknown>;
  status?: string;
  bom_code?: string;
  from_version?: string;
  to_version?: string;
}

export async function createBomChange(data: BomChangeCreatePayload) {
  return apiRequest<BomChangeRecord>(`${BASE}/bom/changes`, { method: 'POST', data });
}

export async function getBomChange(changeUuid: string) {
  return apiRequest<BomChangeRecord>(`${BASE}/bom/changes/${changeUuid}`, { method: 'GET' });
}

export async function listBomChanges(params?: {
  material_uuid?: string;
  status?: string;
  page?: number;
  page_size?: number;
}) {
  const res = await apiRequest<{ items?: BomChangeRecord[]; total?: number }>(
    `${BASE}/bom/changes`,
    { method: 'GET', params },
  );
  return {
    items: res.items ?? [],
    total: res.total ?? 0,
  };
}
