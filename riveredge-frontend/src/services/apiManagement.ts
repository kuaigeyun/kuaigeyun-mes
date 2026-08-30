/**
 * 接口管理服务
 * 
 * 提供接口的 CRUD 操作和接口测试功能。
 * 注意：所有 API 自动过滤当前组织的接口
 */

import { apiRequest } from './api';

export interface API {
  uuid: string;
  tenant_id: number;
  name: string;
  code: string;
  description?: string;
  path: string;
  method: string;
  connection_uuid?: string | null;
  connection_name?: string | null;
  connection_type?: string | null;
  category_uuid?: string | null;
  category_name?: string | null;
  request_headers?: Record<string, any>;
  request_params?: Record<string, any>;
  request_body?: Record<string, any>;
  response_format?: Record<string, any>;
  response_example?: Record<string, any>;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface APIListParams {
  page?: number;
  page_size?: number;
  search?: string;
  method?: string;
  is_active?: boolean;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  category_uuid?: string;
  no_category?: boolean;
}

export interface APIListResponse {
  items: API[];
  total: number;
  page: number;
  page_size: number;
}

export interface CreateAPIData {
  name: string;
  code: string;
  description?: string;
  path: string;
  method: string;
  connection_uuid?: string | null;
  category_uuid?: string | null;
  request_headers?: Record<string, any>;
  request_params?: Record<string, any>;
  request_body?: Record<string, any>;
  response_format?: Record<string, any>;
  response_example?: Record<string, any>;
  is_active?: boolean;
  is_system?: boolean;
}

export interface UpdateAPIData {
  name?: string;
  code?: string;
  description?: string;
  path?: string;
  method?: string;
  connection_uuid?: string | null;
  category_uuid?: string | null;
  request_headers?: Record<string, any>;
  request_params?: Record<string, any>;
  request_body?: Record<string, any>;
  response_format?: Record<string, any>;
  response_example?: Record<string, any>;
  is_active?: boolean;
}

export interface APITestRequest {
  headers?: Record<string, any>;
  params?: Record<string, any>;
  body?: Record<string, any>;
}

export interface APITestResponse {
  status_code: number;
  headers: Record<string, any>;
  body: any;
  elapsed_time: number;
}

export interface ApiLibraryItemPreview {
  item_key: string;
  name: string;
  description: string;
}

export interface ApiLibraryPack {
  pack_id: string;
  name: string;
  description: string;
  connector_type: string;
  category_name: string;
  api_count: number;
  items: ApiLibraryItemPreview[];
  source?: 'system' | 'official' | string;
}

export interface ApiLibraryListResponse {
  items: ApiLibraryPack[];
}

export interface InstallApiLibraryPackResult {
  pack_id: string;
  connection_uuid: string;
  connection_code: string;
  connection_type: string;
  category_uuid: string;
  created_count: number;
  skipped_count: number;
  categorized_count: number;
  created_codes: string[];
  skipped_codes: string[];
  categorized_codes: string[];
}

export interface SubmitOfficialApiLibraryPayload {
  name: string;
  description?: string;
  connector_type: string;
  category_name: string;
  category_code?: string;
  category_description?: string;
  api_uuids: string[];
  submitter_hint?: string;
}

export interface SubmitOfficialApiLibraryResult {
  pack_id: string;
  name: string;
  api_count: number;
  status: string;
}

/**
 * 获取接口列表
 * 
 * 自动过滤当前组织的接口。
 * 
 * @param params - 查询参数
 * @returns 接口列表
 */
export async function getAPIList(params?: APIListParams): Promise<APIListResponse> {
  return apiRequest<APIListResponse>('/core/apis', {
    params,
  });
}

/**
 * 获取接口详情
 * 
 * 自动验证组织权限：只能获取当前组织的接口。
 * 
 * @param apiUuid - 接口 UUID
 * @returns 接口信息
 */
export async function getAPIByUuid(apiUuid: string): Promise<API> {
  return apiRequest<API>(`/core/apis/${apiUuid}`);
}

/**
 * 创建接口
 * 
 * 自动设置当前组织的 tenant_id。
 * 
 * @param data - 接口创建数据
 * @returns 创建的接口信息
 */
export async function createAPI(data: CreateAPIData): Promise<API> {
  return apiRequest<API>('/core/apis', {
    method: 'POST',
    data,
  });
}

/**
 * 更新接口
 * 
 * 自动验证组织权限：只能更新当前组织的接口。
 * 
 * @param apiUuid - 接口 UUID
 * @param data - 接口更新数据
 * @returns 更新后的接口信息
 */
export async function updateAPI(apiUuid: string, data: UpdateAPIData): Promise<API> {
  return apiRequest<API>(`/core/apis/${apiUuid}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除接口
 * 
 * 自动验证组织权限：只能删除当前组织的接口。
 * 系统接口不可删除。
 * 
 * @param apiUuid - 接口 UUID
 */
export async function deleteAPI(apiUuid: string): Promise<void> {
  return apiRequest<void>(`/core/apis/${apiUuid}`, {
    method: 'DELETE',
  });
}

/**
 * 测试接口调用
 * 
 * 调用接口并返回测试结果。
 * 
 * @param apiUuid - 接口 UUID
 * @param testRequest - 测试请求数据（可覆盖接口定义的参数）
 * @param timeout - 请求超时时间（秒）
 * @returns 测试结果
 */
export async function testAPI(
  apiUuid: string,
  testRequest: APITestRequest,
  timeout?: number
): Promise<APITestResponse> {
  return apiRequest<APITestResponse>(`/core/apis/${apiUuid}/test`, {
    method: 'POST',
    data: testRequest,
    params: timeout ? { timeout } : undefined,
  });
}

export interface APIProbeRequest {
  connection_uuid: string;
  path: string;
  method?: string;
  request_headers?: Record<string, unknown>;
  request_params?: Record<string, unknown>;
  request_body?: Record<string, unknown>;
}

export interface KingdeeExecuteBillQueryCatalogItem {
  form_id: string;
  name: string;
  default_field_keys: string[];
  fields: Array<{ key: string; label: string }>;
}

/**
 * 编辑弹窗草稿探测（无需已保存接口）
 */
export async function probeAPIDraft(
  data: APIProbeRequest,
  timeout?: number,
): Promise<APITestResponse> {
  return apiRequest<APITestResponse>('/core/apis/actions/probe-draft', {
    method: 'POST',
    data,
    params: timeout ? { timeout } : undefined,
  });
}

/**
 * 金蝶 ExecuteBillQuery 字段目录
 */
export async function getKingdeeExecuteBillQueryCatalog(): Promise<KingdeeExecuteBillQueryCatalogItem[]> {
  const res = await apiRequest<{ items: KingdeeExecuteBillQueryCatalogItem[] }>(
    '/core/apis/integrations/kingdee-galaxy/execute-bill-query/catalog',
  );
  return res.items ?? [];
}

/**
 * 获取系统接口库目录
 */
export async function listApiLibrary(): Promise<ApiLibraryListResponse> {
  return apiRequest<ApiLibraryListResponse>('/core/apis/library');
}

/**
 * 将系统预置接口库包加载到当前组织
 */
export async function installApiLibraryPack(
  packId: string,
  connectionUuid: string,
  itemKeys: string[],
): Promise<InstallApiLibraryPackResult> {
  return apiRequest<InstallApiLibraryPackResult>(`/core/apis/library/${packId}/install`, {
    method: 'POST',
    data: { connection_uuid: connectionUuid, item_keys: itemKeys },
  });
}

/**
 * 获取官方接口库目录（固定地址 kuaigeyun.com）
 */
export async function listOfficialApiLibrary(): Promise<ApiLibraryListResponse> {
  return apiRequest<ApiLibraryListResponse>('/core/apis/library/official');
}

/**
 * 将官方接口库包加载到当前组织
 */
export async function installOfficialApiLibraryPack(
  packId: string,
  connectionUuid: string,
  itemKeys: string[],
): Promise<InstallApiLibraryPackResult> {
  return apiRequest<InstallApiLibraryPackResult>(`/core/apis/library/official/${packId}/install`, {
    method: 'POST',
    data: { connection_uuid: connectionUuid, item_keys: itemKeys },
  });
}

/**
 * 将本组织接口提交到官方接口库
 */
export async function submitOfficialApiLibrary(
  payload: SubmitOfficialApiLibraryPayload,
): Promise<SubmitOfficialApiLibraryResult> {
  return apiRequest<SubmitOfficialApiLibraryResult>('/core/apis/library/official/submit', {
    method: 'POST',
    data: payload,
  });
}

