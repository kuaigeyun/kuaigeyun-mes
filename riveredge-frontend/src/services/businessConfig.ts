/**
 * 业务配置 API 服务
 *
 * 提供业务配置相关的 API 接口
 *
 * Author: Luigi Lu
 * Date: 2026-01-27
 */

import { apiRequest } from './api';

/**
 * 业务配置响应接口
 */
export interface BusinessConfig {
  running_mode: 'simple' | 'full';
  modules: Record<string, boolean>;
  parameters: Record<string, Record<string, any>>;
  mode_switched_at?: string;
}

/**
 * 运行模式切换请求接口
 */
export interface RunningModeSwitchRequest {
  mode: 'simple' | 'full';
  apply_defaults?: boolean;
}

/**
 * 模块开关请求接口
 */
export interface ModuleSwitchRequest {
  module_code: string;
  enabled: boolean;
}

/**
 * 流程参数更新请求接口
 */
export interface ProcessParameterUpdateRequest {
  category: string;
  parameter_key: string;
  value: any;
}

/**
 * 批量流程参数更新请求接口
 */
export interface BatchProcessParameterUpdateRequest {
  parameters: Record<string, Record<string, any>>;
}

/**
 * 获取业务配置
 *
 * @returns 业务配置
 */
export async function getBusinessConfig(): Promise<BusinessConfig> {
  return apiRequest<BusinessConfig>('/infra/business-config', {
    method: 'GET',
  });
}

/**
 * 切换运行模式
 *
 * @param request - 运行模式切换请求
 * @returns 切换结果
 */
export async function switchRunningMode(
  request: RunningModeSwitchRequest
): Promise<{ success: boolean; message: string; running_mode: string; config: BusinessConfig }> {
  return apiRequest('/infra/business-config/running-mode/switch', {
    method: 'POST',
    data: request,
  });
}

/**
 * 更新模块开关
 *
 * @param request - 模块开关请求
 * @returns 更新结果
 */
export async function updateModuleSwitch(
  request: ModuleSwitchRequest
): Promise<{ success: boolean; message: string; module_code: string; enabled: boolean }> {
  return apiRequest('/infra/business-config/modules/switch', {
    method: 'POST',
    data: request,
  });
}

/**
 * 更新流程参数
 *
 * @param request - 流程参数更新请求
 * @returns 更新结果
 */
export async function updateProcessParameter(
  request: ProcessParameterUpdateRequest
): Promise<{ success: boolean; message: string; category: string; parameter_key: string; value: any }> {
  return apiRequest('/infra/business-config/parameters/update', {
    method: 'POST',
    data: request,
  });
}

/**
 * 批量更新流程参数
 *
 * @param request - 批量流程参数更新请求
 * @returns 更新结果
 */
export async function batchUpdateProcessParameters(
  request: BatchProcessParameterUpdateRequest
): Promise<{ success: boolean; message: string; updated_count: number }> {
  return apiRequest('/infra/business-config/parameters/batch-update', {
    method: 'POST',
    data: request,
  });
}

/**
 * PRO版功能访问权限检查响应接口
 */
export interface ProFeatureAccessCheck {
  has_access: boolean;
  is_pro_feature: boolean;
  current_plan: string;
  upgrade_message?: string;
}

/**
 * PRO版功能列表响应接口
 */
export interface ProFeaturesList {
  has_pro_access: boolean;
  current_plan: string;
  pro_modules: string[];
  pro_parameters: Record<string, string[]>;
}

/**
 * 检查PRO版功能访问权限
 *
 * @param featureType - 功能类型（modules/parameters）
 * @param featureCode - 功能代码
 * @returns 检查结果
 */
export async function checkProFeatureAccess(
  featureType: string,
  featureCode: string
): Promise<ProFeatureAccessCheck> {
  return apiRequest<ProFeatureAccessCheck>(
    `/infra/business-config/pro-features/check?feature_type=${featureType}&feature_code=${featureCode}`,
    {
      method: 'GET',
    }
  );
}

/**
 * 获取PRO版功能列表
 *
 * @returns PRO版功能列表
 */
export async function getProFeaturesList(): Promise<ProFeaturesList> {
  return apiRequest<ProFeaturesList>('/infra/business-config/pro-features/list', {
    method: 'GET',
  });
}

/**
 * 配置模板接口
 */
export interface ConfigTemplate {
  id: number;
  name: string;
  description?: string;
  config: BusinessConfig;
  created_at: string;
}

/**
 * 配置模板保存请求接口
 */
export interface ConfigTemplateSaveRequest {
  template_name: string;
  template_description?: string;
}

/**
 * 配置模板应用请求接口
 */
export interface ConfigTemplateApplyRequest {
  template_id: number;
}

/**
 * 保存配置模板
 *
 * @param request - 配置模板保存请求
 * @returns 保存结果
 */
export async function saveConfigTemplate(
  request: ConfigTemplateSaveRequest
): Promise<{ success: boolean; message: string; template: ConfigTemplate }> {
  return apiRequest('/infra/business-config/templates/save', {
    method: 'POST',
    data: request,
  });
}

/**
 * 获取配置模板列表
 *
 * @returns 配置模板列表
 */
export async function getConfigTemplates(): Promise<ConfigTemplate[]> {
  return apiRequest<ConfigTemplate[]>('/infra/business-config/templates', {
    method: 'GET',
  });
}

/**
 * 应用配置模板
 *
 * @param request - 配置模板应用请求
 * @returns 应用结果
 */
export async function applyConfigTemplate(
  request: ConfigTemplateApplyRequest
): Promise<{ success: boolean; message: string; template: ConfigTemplate }> {
  return apiRequest('/infra/business-config/templates/apply', {
    method: 'POST',
    data: request,
  });
}

/**
 * 删除配置模板
 *
 * @param templateId - 模板ID
 * @returns 删除结果
 */
export async function deleteConfigTemplate(
  templateId: number
): Promise<{ success: boolean; message: string }> {
  return apiRequest(`/infra/business-config/templates/${templateId}`, {
    method: 'DELETE',
  });
}
