/**
 * 初始化向导 API 服务
 *
 * 提供初始化向导相关的 API 接口
 *
 * Author: Luigi Lu
 * Date: 2025-01-15
 */

import { apiRequest } from './api';

/**
 * 初始化步骤响应接口
 */
export interface InitWizardStep {
  step_id: string;
  title: string;
  description: string;
  order: number;
  required: boolean;
  completed: boolean;
}

/**
 * 初始化步骤列表响应接口
 */
export interface InitStepsResponse {
  steps: InitWizardStep[];
  current_step?: string;
  progress: number;
}

/**
 * 步骤1：组织信息完善
 */
export interface Step1OrganizationInfo {
  organization_code?: string;
  industry?: string;
  scale?: 'small' | 'medium' | 'large';
}

/**
 * 步骤2：默认设置
 */
export interface Step2DefaultSettings {
  timezone: string;
  currency: string;
  language: string;
}

/**
 * 步骤2.5：编码规则配置
 */
export interface Step2_5CodeRules {
  use_default_rules: boolean;
  custom_rules?: Record<string, any>;
}

/**
 * 步骤3：管理员信息
 */
export interface Step3AdminInfo {
  full_name?: string;
  email?: string;
}

/**
 * 步骤4：选择行业模板
 */
export interface Step4Template {
  template_id?: number;
}

/**
 * 初始化向导数据
 */
export interface InitWizardData {
  step1_organization_info?: Step1OrganizationInfo;
  step2_default_settings?: Step2DefaultSettings;
  step2_5_code_rules?: Step2_5CodeRules;
  step3_admin_info?: Step3AdminInfo;
  step4_template?: Step4Template;
}

/**
 * 完成步骤请求
 */
export interface StepCompleteRequest {
  step_id: string;
  data: Record<string, any>;
}

/**
 * 完成初始化向导请求
 */
export interface InitWizardCompleteRequest {
  data: InitWizardData;
}

/**
 * 初始化向导响应
 */
export interface InitWizardResponse {
  success: boolean;
  message: string;
  tenant_id: number;
}

/**
 * 获取初始化步骤列表
 *
 * @param tenantId - 组织ID
 * @returns 初始化步骤列表响应
 */
export async function getInitSteps(tenantId: number): Promise<InitStepsResponse> {
  return apiRequest<InitStepsResponse>(`/infra/init/steps?tenant_id=${tenantId}`, {
    method: 'GET',
  });
}

/**
 * 完成初始化步骤
 *
 * @param stepId - 步骤ID
 * @param data - 步骤数据
 * @returns 完成结果
 */
export async function completeStep(
  stepId: string,
  data: Record<string, any>
): Promise<{ success: boolean; message: string; step_id: string }> {
  return apiRequest(`/infra/init/steps/${stepId}/complete`, {
    method: 'POST',
    data: {
      step_id: stepId,
      data,
    },
  });
}

/**
 * 完成初始化向导
 *
 * @param tenantId - 组织ID
 * @param data - 初始化数据
 * @returns 初始化完成响应
 */
export async function completeInitWizard(
  tenantId: number,
  data: InitWizardData
): Promise<InitWizardResponse> {
  return apiRequest<InitWizardResponse>(`/infra/init/tenants/${tenantId}/init`, {
    method: 'POST',
    data: {
      data,
    },
  });
}

