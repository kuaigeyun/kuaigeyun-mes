/**
 * 登录页专用公开接口（轻量）
 *
 * 避免引入 services/api.ts 的全局依赖链，缩短登录首包解析与执行时间。
 */

export interface LoginRequest {
  username: string;
  password: string;
  tenant_id?: number;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: {
    id: number;
    uuid: string;
    username: string;
    email?: string;
    full_name?: string;
    tenant_id?: number;
    tenant_name?: string;
    is_infra_admin?: boolean;
    is_tenant_admin?: boolean;
    permissions?: string[];
    permission_version?: number;
    department?: { uuid: string; name: string };
    position?: { uuid: string; name: string };
    roles?: Array<{ uuid: string; name: string; code: string }>;
  };
  tenants?: Array<{
    id: number;
    uuid: string;
    name: string;
    domain: string;
    status: string;
  }>;
  default_tenant_id?: number;
  requires_tenant_selection?: boolean;
}

/** 登录响应中的组织名称（唯一来源：后端 user.tenant_name） */
export function tenantNameFromLoginResponse(response: LoginResponse): string {
  return response.user?.tenant_name?.trim() ?? '';
}

export interface TenantCheckResponse {
  exists: boolean;
  tenant_id?: number;
  tenant_name?: string;
}

export interface TenantSearchOption {
  tenant_id: number;
  tenant_name: string;
  tenant_domain: string;
}

export interface TenantSearchResponse {
  items: TenantSearchOption[];
  total: number;
}

export interface PersonalRegisterRequest {
  username: string;
  phone: string;
  email?: string;
  password: string;
  full_name?: string;
  tenant_id?: number;
  invite_code?: string;
}

export interface PersonalRegisterResponse {
  success: boolean;
  message: string;
  user_id?: number;
}

export interface OrganizationRegisterRequest {
  tenant_name: string;
  phone: string;
  password: string;
  tenant_domain?: string;
  email?: string;
  full_name?: string;
}

export interface OrganizationRegisterResponse {
  success: boolean;
  message: string;
  tenant_id?: number;
  user_id?: number;
}

const API_BASE_URL = '/api/v1';

async function publicRequest<T>(url: string, options?: { method?: string; data?: unknown; params?: Record<string, unknown> }): Promise<T> {
  let requestUrl = `${API_BASE_URL}${url}`;

  if (options?.params) {
    const params = new URLSearchParams();
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });
    const query = params.toString();
    if (query) requestUrl += `?${query}`;
  }

  const response = await fetch(requestUrl, {
    method: options?.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: options?.data !== undefined ? JSON.stringify(options.data) : undefined,
  });

  let data: any = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const detail = data?.error?.message || data?.detail || data?.message || `HTTP error: ${response.status}`;
    const error = new Error(typeof detail === 'string' ? detail : JSON.stringify(detail)) as any;
    error.response = { status: response.status, data };
    throw error;
  }

  if (data && typeof data === 'object') {
    if (data.success === true && 'data' in data) return data.data as T;
    if (data.success === false && data.error) {
      throw new Error(data.error.message || '请求失败');
    }
  }

  return data as T;
}

export async function login(data: LoginRequest): Promise<LoginResponse> {
  return publicRequest<LoginResponse>('/auth/login', { method: 'POST', data });
}

export async function guestLogin(): Promise<LoginResponse> {
  return publicRequest<LoginResponse>('/auth/guest-login', { method: 'POST' });
}

export async function wechatLoginCallback(code: string): Promise<LoginResponse> {
  return publicRequest<LoginResponse>('/auth/wechat/callback', { method: 'POST', data: { code } });
}

export async function searchTenants(keyword: string): Promise<TenantSearchResponse> {
  return publicRequest<TenantSearchResponse>('/tenants/search', { params: { keyword, page: 1, page_size: 10 } });
}

export async function registerPersonal(data: PersonalRegisterRequest): Promise<PersonalRegisterResponse> {
  return publicRequest<PersonalRegisterResponse>('/auth/register/personal', { method: 'POST', data });
}

export async function registerOrganization(data: OrganizationRegisterRequest): Promise<OrganizationRegisterResponse> {
  return publicRequest<OrganizationRegisterResponse>('/auth/register/organization', { method: 'POST', data });
}
