/**
 * 打印模板管理服务
 * 
 * 提供打印模板的 CRUD 操作和模板渲染功能。
 * 注意：所有 API 自动过滤当前组织的打印模板
 */

import { apiRequest } from './api';

export interface PrintTemplate {
  uuid: string;
  tenant_id: number;
  name: string;
  code: string;
  type: string;
  description?: string;
  content: string;
  config?: Record<string, any>;
  is_active: boolean;
  is_default: boolean;
  inngest_function_id?: string;
  usage_count: number;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PrintTemplateListParams {
  skip?: number;
  limit?: number;
  type?: string;
  is_active?: boolean;
}

export interface CreatePrintTemplateData {
  name: string;
  code: string;
  type: string;
  description?: string;
  content: string;
  config?: Record<string, any>;
}

export interface UpdatePrintTemplateData {
  name?: string;
  description?: string;
  content?: string;
  config?: Record<string, any>;
  is_active?: boolean;
  is_default?: boolean;
}

export interface RenderPrintTemplateData {
  data: Record<string, any>;
  output_format?: string;
  async_execution?: boolean;
}

export interface PrintTemplateRenderResponse {
  success: boolean;
  file_url?: string;
  file_uuid?: string;
  error?: string;
  inngest_run_id?: string;
}

/**
 * 获取打印模板列表
 */
export async function getPrintTemplateList(params?: PrintTemplateListParams): Promise<PrintTemplate[]> {
  return apiRequest<PrintTemplate[]>('/system/print-templates', {
    params,
  });
}

/**
 * 获取打印模板详情
 */
export async function getPrintTemplateByUuid(printTemplateUuid: string): Promise<PrintTemplate> {
  return apiRequest<PrintTemplate>(`/system/print-templates/${printTemplateUuid}`);
}

/**
 * 创建打印模板
 */
export async function createPrintTemplate(data: CreatePrintTemplateData): Promise<PrintTemplate> {
  return apiRequest<PrintTemplate>('/system/print-templates', {
    method: 'POST',
    data,
  });
}

/**
 * 更新打印模板
 */
export async function updatePrintTemplate(printTemplateUuid: string, data: UpdatePrintTemplateData): Promise<PrintTemplate> {
  return apiRequest<PrintTemplate>(`/system/print-templates/${printTemplateUuid}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除打印模板
 */
export async function deletePrintTemplate(printTemplateUuid: string): Promise<void> {
  return apiRequest<void>(`/system/print-templates/${printTemplateUuid}`, {
    method: 'DELETE',
  });
}

/**
 * 渲染打印模板
 */
export async function renderPrintTemplate(printTemplateUuid: string, data: RenderPrintTemplateData): Promise<PrintTemplateRenderResponse> {
  return apiRequest<PrintTemplateRenderResponse>(`/system/print-templates/${printTemplateUuid}/render`, {
    method: 'POST',
    data,
  });
}

