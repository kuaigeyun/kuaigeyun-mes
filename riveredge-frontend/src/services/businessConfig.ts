/**
 * 业务配置 API 服务
 *
 * 变更说明（2026 重构）：
 * - 业务蓝图设置已下线；功能开关改由菜单管理控制，审核改由流程设置控制。
 * - 本文件仅保留纯「参数」读写（bom / sales / purchase / finance 等）
 *   以及 PRO 功能检查相关接口。旧版 modules/nodes/running-mode/
 *   complexity-presets/templates 接口已删除。
 */

import { apiRequest } from './api';

export interface BusinessConfig {
  parameters: Record<string, Record<string, any>>;
}

export interface ProcessParameterUpdateRequest {
  category: string;
  parameter_key: string;
  value: any;
}

export interface BatchProcessParameterUpdateRequest {
  parameters: Record<string, Record<string, any>>;
}

export interface BusinessConfigSchema {
  processRegistry?: Record<string, string[]>;
  processRegistryMeta?: Record<string, { labelKey?: string; descriptionKey?: string }>;
  processRegistryParamMeta?: Record<string, Record<string, { labelKey?: string; descriptionKey?: string }>>;
  processRegistryControlMeta?: Record<
    string,
    Record<string, { type?: 'boolean' | 'number' | 'string' | 'color' | 'select'; min?: number; max?: number; options?: { value: string; labelKey: string }[] }>
  >;
  parameterRegistry?: Record<string, string[]>;
  parameterRegistryMeta?: Record<string, { labelKey?: string; descriptionKey?: string }>;
  parameterRegistryParamMeta?: Record<string, Record<string, { labelKey?: string; descriptionKey?: string }>>;
  parameterRegistryControlMeta?: Record<
    string,
    Record<string, { type?: 'boolean' | 'number' | 'string' | 'color' | 'select'; min?: number; max?: number; options?: { value: string; labelKey: string }[] }>
  >;
  parameterKeys: Record<string, string[]>;
  parameterImplementation?: Record<string, Record<string, boolean>>;
}

export async function getBusinessConfigSchema(): Promise<BusinessConfigSchema> {
  return apiRequest<BusinessConfigSchema>('/infra/business-config/schema', {
    method: 'GET',
  });
}

export async function getBusinessConfig(): Promise<BusinessConfig> {
  return apiRequest<BusinessConfig>('/infra/business-config', {
    method: 'GET',
  });
}

/** 是否开启试运营模式（读取 parameters.common.trial_run_mode，默认 false） */
export function isTrialRunModeEnabled(config: BusinessConfig | null | undefined): boolean {
  return Boolean(config?.parameters?.common?.trial_run_mode);
}

export async function updateProcessParameter(
  request: ProcessParameterUpdateRequest
): Promise<{ success: boolean; message: string; category: string; parameter_key: string; value: any }> {
  return apiRequest('/infra/business-config/parameters/update', {
    method: 'POST',
    data: request,
  });
}

export async function batchUpdateProcessParameters(
  request: BatchProcessParameterUpdateRequest
): Promise<{ success: boolean; message: string; updated_count: number }> {
  return apiRequest('/infra/business-config/parameters/batch-update', {
    method: 'POST',
    data: request,
  });
}

export interface ProFeatureAccessCheck {
  has_access: boolean;
  is_pro_feature: boolean;
  current_plan: string;
  upgrade_message?: string;
}

export interface ProFeaturesList {
  has_pro_access: boolean;
  current_plan: string;
  pro_modules: string[];
  pro_parameters: Record<string, string[]>;
}

export interface AuditRequiredMapResponse {
  audit_required: Record<string, boolean>;
}

export async function getAuditRequiredMap(): Promise<Record<string, boolean>> {
  const res = await apiRequest<AuditRequiredMapResponse>('/infra/business-config/audit-required', {
    method: 'GET',
  });
  return res?.audit_required ?? {};
}

export async function checkProFeatureAccess(
  featureType: string,
  featureCode: string
): Promise<ProFeatureAccessCheck> {
  return apiRequest<ProFeatureAccessCheck>(
    `/infra/business-config/pro-features/check?feature_type=${featureType}&feature_code=${featureCode}`,
    { method: 'GET' }
  );
}

export async function getProFeaturesList(): Promise<ProFeaturesList> {
  return apiRequest<ProFeaturesList>('/infra/business-config/pro-features/list', {
    method: 'GET',
  });
}
