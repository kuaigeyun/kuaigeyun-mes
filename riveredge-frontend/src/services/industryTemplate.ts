/**
 * 行业模板 API 服务
 *
 * 提供行业模板相关的 API 接口
 *
 * Author: Luigi Lu
 * Date: 2025-01-15
 */

import { apiRequest } from './api';

/**
 * 行业模板信息接口
 */
export interface IndustryTemplate {
  id: number;
  uuid: string;
  name: string;
  code: string;
  industry: string;
  description?: string;
  config: Record<string, any>;
  is_active: boolean;
  is_default: boolean;
  usage_count: number;
  last_used_at?: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * 行业模板列表响应接口
 */
export interface IndustryTemplateListResponse {
  items: IndustryTemplate[];
  total: number;
}

/**
 * 应用模板请求参数
 */
export interface ApplyTemplateParams {
  tenant_id: number;
  template_id: number;
}

/**
 * 应用模板响应接口
 */
export interface ApplyTemplateResponse {
  success: boolean;
  message: string;
  template_id: number;
  tenant_id: number;
  applied_config: Record<string, any>;
}

/**
 * 获取行业模板列表
 *
 * @param industry - 行业类型筛选（可选）
 * @param is_active - 是否只返回启用的模板（可选，默认true）
 * @returns 模板列表
 */
export async function getIndustryTemplateList(
  industry?: string,
  is_active?: boolean
): Promise<IndustryTemplateListResponse> {
  const params: Record<string, any> = {};
  if (industry) {
    params.industry = industry;
  }
  if (is_active !== undefined) {
    params.is_active = is_active;
  }
  
  return apiRequest<IndustryTemplateListResponse>('/infra/templates', {
    params,
  });
}

/**
 * 根据ID获取行业模板详情
 *
 * @param templateId - 模板ID
 * @returns 模板详情
 */
export async function getIndustryTemplateById(templateId: number): Promise<IndustryTemplate> {
  return apiRequest<IndustryTemplate>(`/infra/templates/${templateId}`);
}

/**
 * 应用行业模板到指定组织
 *
 * @param templateId - 模板ID
 * @param tenantId - 组织ID
 * @returns 应用结果
 */
export async function applyIndustryTemplate(
  templateId: number,
  tenantId: number
): Promise<ApplyTemplateResponse> {
  return apiRequest<ApplyTemplateResponse>(`/infra/templates/${templateId}/apply`, {
    method: 'POST',
    params: {
      tenant_id: tenantId,
    },
  });
}

