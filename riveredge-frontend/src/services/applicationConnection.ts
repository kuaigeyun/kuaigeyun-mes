/**
 * 应用连接管理服务
 *
 * 提供应用连接的 CRUD 操作和连接测试功能。
 * 请求路径：/core/application-connections
 */

import { apiRequest } from './api';

export interface ApplicationConnection {
  uuid: string;
  tenant_id: number;
  name: string;
  code: string;
  type: string;
  description?: string;
  config: Record<string, any>;
  is_active: boolean;
  is_connected: boolean;
  last_connected_at?: string;
  last_error?: string;
  created_at: string;
  updated_at: string;
}

export interface ApplicationConnectionListParams {
  page?: number;
  page_size?: number;
  search?: string;
  type?: string;
  is_active?: boolean;
}

export interface ApplicationConnectionListResponse {
  items: ApplicationConnection[];
  total: number;
  page: number;
  page_size: number;
}

export interface ApplicationConnectionCreate {
  name: string;
  code: string;
  type: string;
  description?: string;
  config: Record<string, any>;
  is_active?: boolean;
}

export interface ApplicationConnectionUpdate {
  name?: string;
  description?: string;
  config?: Record<string, any>;
  is_active?: boolean;
}

export interface TestConnectionResponse {
  success: boolean;
  message: string;
  data?: Record<string, any>;
  error?: string;
}

/** 与后端 application_connections 列表 API 的 page_size 上限一致 */
export const APPLICATION_CONNECTION_LIST_MAX_PAGE_SIZE = 100;

export async function getApplicationConnectionList(
  params?: ApplicationConnectionListParams
): Promise<ApplicationConnectionListResponse> {
  const { page = 1, page_size = 20, search, type, is_active } = params || {};
  const result = await apiRequest<ApplicationConnectionListResponse>('/core/application-connections', {
    params: { page, page_size, search, type, is_active },
  });
  return result;
}

/** 按筛选条件拉取全部应用连接（多页拼接，每页不超过 {@link APPLICATION_CONNECTION_LIST_MAX_PAGE_SIZE}） */
export async function getApplicationConnectionListAll(
  params?: Omit<ApplicationConnectionListParams, 'page' | 'page_size'>,
): Promise<ApplicationConnection[]> {
  const page_size = APPLICATION_CONNECTION_LIST_MAX_PAGE_SIZE;
  let page = 1;
  const out: ApplicationConnection[] = [];
  for (;;) {
    const res = await getApplicationConnectionList({ ...params, page, page_size });
    out.push(...res.items);
    if (res.items.length === 0 || res.items.length < page_size || out.length >= res.total) {
      break;
    }
    page += 1;
    if (page > 500) break;
  }
  return out;
}

export async function getApplicationConnectionByUuid(uuid: string): Promise<ApplicationConnection> {
  return apiRequest<ApplicationConnection>(`/core/application-connections/${uuid}`);
}

export async function createApplicationConnection(
  data: ApplicationConnectionCreate
): Promise<ApplicationConnection> {
  return apiRequest<ApplicationConnection>('/core/application-connections', {
    method: 'POST',
    data,
  });
}

export async function updateApplicationConnection(
  uuid: string,
  data: ApplicationConnectionUpdate
): Promise<ApplicationConnection> {
  return apiRequest<ApplicationConnection>(`/core/application-connections/${uuid}`, {
    method: 'PUT',
    data,
  });
}

export async function deleteApplicationConnection(uuid: string): Promise<void> {
  return apiRequest<void>(`/core/application-connections/${uuid}`, {
    method: 'DELETE',
  });
}

/**
 * apiRequest 对 { success: true, data } 会解包成 data，导致调用方读不到 success。
 * 测试接口成功时 data 含 verification_level，在此还原为完整 TestConnectionResponse。
 */
function normalizeTestConnectionResponse(raw: any): TestConnectionResponse {
  if (raw && typeof raw === 'object') {
    if (raw.success === true || raw.success === false) {
      return raw as TestConnectionResponse;
    }
    if (raw.verification_level === 'live' || raw.verification_level === 'config_only') {
      return {
        success: true,
        message: typeof raw.message === 'string' ? raw.message : '',
        data: raw,
      };
    }
  }
  return {
    success: false,
    message: typeof raw?.message === 'string' ? raw.message : '',
    error: typeof raw?.error === 'string' ? raw.error : undefined,
    data: raw && typeof raw === 'object' ? raw : undefined,
  };
}

export async function testApplicationConnection(uuid: string): Promise<TestConnectionResponse> {
  const raw = await apiRequest<any>(`/core/application-connections/${uuid}/test`, {
    method: 'POST',
  });
  return normalizeTestConnectionResponse(raw);
}

export async function testApplicationConnectionConfig(
  type: string,
  config: Record<string, any>
): Promise<TestConnectionResponse> {
  const raw = await apiRequest<any>('/core/application-connections/test-config', {
    method: 'POST',
    data: { type, config },
  });
  return normalizeTestConnectionResponse(raw);
}

export interface SyncContactsResponse {
  success: boolean;
  message: string;
  departments?: { created?: number; updated?: number; skipped?: number };
  users?: { created?: number; updated?: number; skipped?: number; bound?: number };
  synced_at?: string;
  error?: string;
}

/** 同步企业微信通讯录（部门 + 成员） */
export async function syncApplicationConnectionContacts(
  uuid: string,
): Promise<SyncContactsResponse> {
  return apiRequest<SyncContactsResponse>(`/core/application-connections/${uuid}/sync-contacts`, {
    method: 'POST',
  });
}

export interface LoadConnectorApiPresetsResponse {
  connection_uuid: string;
  connection_code: string;
  connection_type: string;
  created_count: number;
  skipped_count: number;
  created_codes: string[];
  skipped_codes: string[];
}

/** 为业务系统连接器加载常用接口预设（如金蝶云星空） */
export async function loadApplicationConnectionApiPresets(
  uuid: string,
): Promise<LoadConnectorApiPresetsResponse> {
  return apiRequest<LoadConnectorApiPresetsResponse>(
    `/core/application-connections/${uuid}/load-api-presets`,
    { method: 'POST' },
  );
}

export interface ConnectorDefinition {
  id: string;
  name: string;
  type: string;
  category: string;
  description?: string;
  icon?: string;
  default_config?: Record<string, any>;
}

export interface ConnectorDefinitionsResponse {
  items: ConnectorDefinition[];
  categories: { key: string; label: string }[];
}

export async function getConnectorDefinitions(
  category?: string
): Promise<ConnectorDefinitionsResponse> {
  return apiRequest<ConnectorDefinitionsResponse>('/core/connector-definitions', {
    params: category && category !== 'all' ? { category } : undefined,
  });
}
