/**
 * 站点设置 API 服务
 * 
 * 提供站点设置管理相关的 API 接口
 */

import { apiRequest } from './api';
import { queryClient } from '../queryClient';
import { buildSiteSettingQueryKey, SITE_SETTING_QUERY_ROOT } from '../config/sessionQueries';
import { getTenantId } from '../utils/auth';

/**
 * 站点设置信息接口
 */
export interface SiteSetting {
  uuid: string;
  tenant_id: number;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

/**
 * 更新站点设置数据
 */
export interface UpdateSiteSettingData {
  settings: Record<string, any>;
}

export interface SubtenantCapability {
  tenant_id: number;
  is_subtenant: boolean;
  can_create_subtenant: boolean;
}

export interface BranchOrganizationCapability {
  tenant_id: number;
  is_branch_organization: boolean;
  can_create_branch_organization: boolean;
}

export interface BranchOrganizationItem {
  id: number;
  uuid: string;
  name: string;
  domain: string;
  status: string;
  plan: string;
  max_users: number;
  user_count?: number;
  created_at: string;
}

export interface BranchOrganizationListResponse {
  items: BranchOrganizationItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface TenantDomainAvailability {
  domain: string;
  available: boolean;
  message: string;
}

export interface CreateSubtenantData {
  name: string;
  domain: string;
  admin_account?: {
    username: string;
    password: string;
    full_name?: string;
    phone?: string;
  };
}

export interface UpdateBranchOrganizationData {
  name?: string;
  domain?: string;
  status?: string;
}

/** 壳层启动时 theme / i18n / fetchConfigs 并发调用，合并为同一次请求 */
let siteSettingInFlight: Promise<SiteSetting> | null = null;

/**
 * 获取站点设置
 * 
 * 获取当前组织的站点设置，如果不存在则自动创建。
 * 
 * @returns 站点设置信息
 */
export async function getSiteSetting(): Promise<SiteSetting> {
  if (!siteSettingInFlight) {
    siteSettingInFlight = apiRequest<SiteSetting>('/core/site-settings').finally(() => {
      siteSettingInFlight = null;
    });
  }
  return siteSettingInFlight;
}

/**
 * 更新站点设置
 * 
 * 更新当前组织的站点设置。
 * 
 * @param data - 站点设置更新数据
 * @returns 更新后的站点设置信息
 */
export async function updateSiteSetting(data: UpdateSiteSettingData): Promise<SiteSetting> {
  const result = await apiRequest<SiteSetting>('/core/site-settings', {
    method: 'PUT',
    data,
  });
  // 避免随后 getSiteSetting / react-query 读到保存前的缓存
  siteSettingInFlight = null;
  queryClient.setQueryData(buildSiteSettingQueryKey(getTenantId()), result);
  void queryClient.invalidateQueries({ queryKey: [SITE_SETTING_QUERY_ROOT] });
  return result;
}

export async function getSubtenantCapability(): Promise<SubtenantCapability> {
  return apiRequest<SubtenantCapability>('/core/site-settings/subtenants/capability');
}

export async function createSubtenantFromSiteSettings(data: CreateSubtenantData) {
  return apiRequest('/core/site-settings/subtenants', {
    method: 'POST',
    data,
  });
}

export async function getBranchOrganizationCapability(): Promise<BranchOrganizationCapability> {
  return apiRequest<BranchOrganizationCapability>('/core/site-settings/branch-organizations/capability');
}

export async function getBranchOrganizationList(params?: { page?: number; page_size?: number }): Promise<BranchOrganizationListResponse> {
  return apiRequest<BranchOrganizationListResponse>('/core/site-settings/branch-organizations', {
    params,
  });
}

export async function createBranchOrganization(data: CreateSubtenantData) {
  return apiRequest('/core/site-settings/branch-organizations', {
    method: 'POST',
    data,
  });
}

export async function updateBranchOrganization(branchOrgId: number, data: UpdateBranchOrganizationData) {
  return apiRequest(`/core/site-settings/branch-organizations/${branchOrgId}`, {
    method: 'PUT',
    data,
  });
}

export async function checkTenantDomainAvailability(domain: string): Promise<TenantDomainAvailability> {
  return apiRequest<TenantDomainAvailability>('/core/site-settings/domain-availability', {
    method: 'GET',
    params: { domain },
  });
}

