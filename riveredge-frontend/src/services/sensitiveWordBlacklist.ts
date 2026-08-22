import { apiRequest } from './api';

export interface SensitiveWordBlacklistMeta {
  menu_visible: boolean;
  enabled_tenant_count: number;
  enabled_tenants: Array<{ id: number; name: string; domain: string }>;
}

export interface SensitiveWordBanItem {
  id: number;
  tenant_id: number;
  tenant_name?: string | null;
  user_id: number;
  username?: string | null;
  full_name?: string | null;
  client_ip: string;
  banned_at: string;
  unbanned_at?: string | null;
  is_active: boolean;
  trigger_request_path?: string | null;
  trigger_field_path?: string | null;
  trigger_matched_word?: string | null;
  trigger_content_snippet?: string | null;
}

export interface SensitiveWordBanListResponse {
  items: SensitiveWordBanItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface TenantSensitiveWordAllowlistItem {
  id: number;
  tenant_id: number;
  word: string;
  note?: string | null;
  created_at: string;
}

export interface TenantSensitiveWordAllowlistListResponse {
  items: TenantSensitiveWordAllowlistItem[];
  total: number;
  page: number;
  page_size: number;
}

export async function getSensitiveWordBlacklistMeta(): Promise<SensitiveWordBlacklistMeta> {
  return apiRequest<SensitiveWordBlacklistMeta>('/infra/sensitive-word-blacklist/meta');
}

export async function listSensitiveWordBans(params: {
  page?: number;
  page_size?: number;
  tenant_id?: number;
  active_only?: boolean;
}): Promise<SensitiveWordBanListResponse> {
  return apiRequest<SensitiveWordBanListResponse>('/infra/sensitive-word-blacklist/bans', {
    params,
  });
}

export async function unbanSensitiveWordSubject(banId: number): Promise<void> {
  await apiRequest(`/infra/sensitive-word-blacklist/bans/${banId}/unban`, {
    method: 'POST',
  });
}

export async function listTenantSensitiveWordAllowlist(params: {
  tenant_id: number;
  page?: number;
  page_size?: number;
}): Promise<TenantSensitiveWordAllowlistListResponse> {
  return apiRequest<TenantSensitiveWordAllowlistListResponse>('/infra/sensitive-word-blacklist/allowlist', {
    params,
  });
}

export async function addTenantSensitiveWordAllowlist(data: {
  tenant_id: number;
  word: string;
  note?: string;
}): Promise<TenantSensitiveWordAllowlistItem> {
  return apiRequest<TenantSensitiveWordAllowlistItem>('/infra/sensitive-word-blacklist/allowlist', {
    method: 'POST',
    data,
  });
}

export async function removeTenantSensitiveWordAllowlist(allowlistId: number): Promise<void> {
  await apiRequest(`/infra/sensitive-word-blacklist/allowlist/${allowlistId}`, {
    method: 'DELETE',
  });
}
