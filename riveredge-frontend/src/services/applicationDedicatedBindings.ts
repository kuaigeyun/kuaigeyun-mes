/**
 * 定制应用组织绑定（Core API，需平台管理员 is_infra_admin）
 */

import { apiRequest } from './api';

export interface DedicatedBindingRow {
  id: number;
  app_code: string;
  tenant_id: number;
  tenant_name?: string | null;
  created_at: string;
}

export interface TenantSearchForBindingItem {
  id: number;
  name: string;
  domain?: string | null;
}

export async function listDedicatedBindingsForApp(appCode: string): Promise<DedicatedBindingRow[]> {
  return apiRequest<DedicatedBindingRow[]>('/core/application-dedicated-bindings', {
    method: 'GET',
    params: { app_code: appCode },
  });
}

export async function bindDedicatedAppToTenant(appCode: string, tenantId: number): Promise<void> {
  await apiRequest<void>('/core/application-dedicated-bindings', {
    method: 'POST',
    data: { app_code: appCode, tenant_id: tenantId },
  });
}

export async function unbindDedicatedAppFromTenant(appCode: string, tenantId: number): Promise<void> {
  await apiRequest<void>('/core/application-dedicated-bindings', {
    method: 'DELETE',
    params: { app_code: appCode, tenant_id: tenantId },
  });
}

export async function searchTenantsForDedicatedBinding(params: {
  name?: string;
  page?: number;
  page_size?: number;
}): Promise<{ items: TenantSearchForBindingItem[]; total: number }> {
  return apiRequest<{ items: TenantSearchForBindingItem[]; total: number }>(
    '/core/application-dedicated-bindings/tenant-search',
    {
      method: 'GET',
      params: {
        name: params.name,
        page: params.page ?? 1,
        page_size: params.page_size ?? 50,
      },
    },
  );
}
