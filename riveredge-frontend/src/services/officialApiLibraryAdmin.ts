/**
 * 平台级官方接口库管理（infra 超管）
 */

import { apiRequest } from './api';

const ADMIN_BASE = '/infra/official-api-library/admin';

export type OfficialApiLibraryAdminMeta = {
  host: string;
  default_host: string;
  base_url: string;
  default_base_url: string;
  local_writable: boolean;
  manage_table_visible: boolean;
};

export type OfficialApiLibraryItem = {
  item_key: string;
  name: string;
  description?: string;
  path?: string;
  method?: string;
  request_headers?: Record<string, unknown> | null;
  request_params?: Record<string, unknown> | null;
  request_body?: unknown;
  response_format?: Record<string, unknown> | null;
  response_example?: unknown;
};

export type OfficialApiLibraryPack = {
  pack_id: string;
  name: string;
  description: string;
  connector_type: string;
  category_name: string;
  category_code: string;
  category_description: string;
  status: string;
  api_count: number;
  items: OfficialApiLibraryItem[];
  source?: string;
  submitter_hint?: string;
  source_host_hint?: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export type OfficialApiLibraryPackList = {
  base_url: string;
  local_writable: boolean;
  items: OfficialApiLibraryPack[];
};

export type OfficialApiLibraryPackUpdateInput = {
  name?: string;
  description?: string;
  connector_type?: string;
  category_name?: string;
  category_code?: string;
  category_description?: string;
  status?: string;
  items?: OfficialApiLibraryItem[];
};

export async function getOfficialApiLibraryAdminMeta(): Promise<OfficialApiLibraryAdminMeta> {
  return apiRequest<OfficialApiLibraryAdminMeta>(`${ADMIN_BASE}/meta`);
}

export async function updateOfficialApiLibraryAdminMeta(
  host: string,
): Promise<OfficialApiLibraryAdminMeta> {
  return apiRequest<OfficialApiLibraryAdminMeta>(`${ADMIN_BASE}/meta`, {
    method: 'PUT',
    data: { host },
  });
}

export async function listOfficialApiLibraryAdminPacks(
  statusFilter?: string,
): Promise<OfficialApiLibraryPackList> {
  return apiRequest<OfficialApiLibraryPackList>(`${ADMIN_BASE}/packs`, {
    params: statusFilter ? { status_filter: statusFilter } : undefined,
  });
}

export async function getOfficialApiLibraryAdminPack(
  packId: string,
): Promise<OfficialApiLibraryPack> {
  return apiRequest<OfficialApiLibraryPack>(
    `${ADMIN_BASE}/packs/${encodeURIComponent(packId)}`,
  );
}

export async function updateOfficialApiLibraryAdminPack(
  packId: string,
  input: OfficialApiLibraryPackUpdateInput,
): Promise<OfficialApiLibraryPack> {
  return apiRequest<OfficialApiLibraryPack>(
    `${ADMIN_BASE}/packs/${encodeURIComponent(packId)}`,
    { method: 'PUT', data: input },
  );
}

export async function deleteOfficialApiLibraryAdminPack(packId: string): Promise<void> {
  await apiRequest<{ success: boolean }>(
    `${ADMIN_BASE}/packs/${encodeURIComponent(packId)}`,
    { method: 'DELETE' },
  );
}
