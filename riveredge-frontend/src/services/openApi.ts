/**
 * 开放 API 账套 / 应用管理
 * 路径前缀：/core/open-api
 */

import { apiRequest } from './api';

export interface OpenApiAccount {
  uuid: string;
  acct_id: string;
  name: string;
  status: string;
  tenant_id: number;
  created_at?: string;
  updated_at?: string;
}

export interface OpenApiApp {
  uuid: string;
  app_id: string;
  name: string;
  status: string;
  ip_allowlist?: string;
  expires_at?: string | null;
  tenant_id: number;
  account_id: number;
  grants: string[];
  modules: string[];
  app_secret?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface OpenApiModuleAction {
  code: string;
  label: string;
  http_methods: string[];
  path: string;
  path_detail?: string;
  description?: string;
}

export interface OpenApiModuleCatalogItem {
  module_key: string;
  label: string;
  group?: string;
  app: string;
  base_path?: string;
  codes: string[];
  actions: OpenApiModuleAction[];
}

export interface OpenApiDocEndpoint {
  code: string;
  label: string;
  http_methods: string[];
  path: string;
  path_detail?: string;
  description?: string;
  curl: string;
  curl_detail?: string | null;
  python: string;
  sample_body?: string | null;
}

export interface OpenApiDocModule {
  module_key: string;
  label: string;
  group?: string;
  base_path?: string;
  endpoints: OpenApiDocEndpoint[];
}

export interface OpenApiIntegrationGuide {
  acct_id: string;
  tenant_id: number;
  base_url: string;
  token_url: string;
  token_url_absolute: string;
  channel_header: string;
  tenant_header: string;
  auth_header: string;
  common_headers: Record<string, string>;
  notes: string[];
  auth_examples: {
    curl: string;
    python: string;
    request_body: Record<string, string>;
    response_example: Record<string, unknown>;
  };
  modules: OpenApiDocModule[];
  permission_matrix: Array<{ action: string; http: string; 说明: string }>;
}

export async function getOpenApiAccount(): Promise<OpenApiAccount> {
  return apiRequest<OpenApiAccount>('/core/open-api/account');
}

export async function rotateOpenApiAcctId(acct_id?: string): Promise<OpenApiAccount> {
  return apiRequest<OpenApiAccount>('/core/open-api/account/rotate-acct-id', {
    method: 'POST',
    data: { acct_id: acct_id || null },
  });
}

export async function getOpenApiModuleCatalog(): Promise<OpenApiModuleCatalogItem[]> {
  const res = await apiRequest<{ items: OpenApiModuleCatalogItem[] }>('/core/open-api/module-catalog');
  return res.items || [];
}

export async function getOpenApiAppList(): Promise<OpenApiApp[]> {
  const res = await apiRequest<{ items: OpenApiApp[] }>('/core/open-api/apps');
  return res.items || [];
}

export async function createOpenApiApp(body: {
  name: string;
  module_keys?: string[];
  permission_codes?: string[];
  ip_allowlist?: string;
}): Promise<OpenApiApp> {
  return apiRequest<OpenApiApp>('/core/open-api/apps', {
    method: 'POST',
    data: body,
  });
}

export async function updateOpenApiApp(
  uuid: string,
  body: {
    name?: string;
    status?: string;
    ip_allowlist?: string;
    module_keys?: string[];
    permission_codes?: string[];
    update_grants?: boolean;
  },
): Promise<OpenApiApp> {
  return apiRequest<OpenApiApp>(`/core/open-api/apps/${uuid}`, {
    method: 'PUT',
    data: body,
  });
}

export async function resetOpenApiAppSecret(uuid: string): Promise<OpenApiApp> {
  return apiRequest<OpenApiApp>(`/core/open-api/apps/${uuid}/reset-secret`, {
    method: 'POST',
  });
}

export async function deleteOpenApiApp(uuid: string): Promise<void> {
  await apiRequest(`/core/open-api/apps/${uuid}`, { method: 'DELETE' });
}

export async function getOpenApiIntegrationGuide(baseUrl?: string): Promise<OpenApiIntegrationGuide> {
  const origin =
    baseUrl ||
    (typeof window !== 'undefined' ? window.location.origin : undefined) ||
    undefined;
  const qs = origin ? `?base_url=${encodeURIComponent(origin)}` : '';
  return apiRequest<OpenApiIntegrationGuide>(`/core/open-api/integration-guide${qs}`);
}
