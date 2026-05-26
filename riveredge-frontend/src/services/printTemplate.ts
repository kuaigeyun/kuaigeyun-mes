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
  document_type?: string;
}

export interface CreatePrintTemplateData {
  name: string;
  code: string;
  type: string;
  description?: string;
  content: string;
  config?: Record<string, any>;
  is_active?: boolean;
  is_default?: boolean;
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
  output_format?: string;
  content?: string;
  content_encoding?: string;
  mime_type?: string;
  message?: string;
  file_url?: string;
  file_uuid?: string;
  error?: string;
  inngest_run_id?: string;
}

export interface NextPrintTemplateCodeResponse {
  code: string;
}

export interface LoadPresetPrintTemplateResponse {
  created: number;
  message: string;
}

export interface CompilePrintTemplateData {
  source_type?: 'designer_json' | 'html_jinja';
  source: Record<string, any> | string;
  target_engine?: 'jinja2';
  document_type?: string;
}

export interface PrintTemplateCompileResponse {
  success: boolean;
  compiled_template: string;
  schema_version?: string;
  warnings?: string[];
}

export interface CompilePreviewPrintTemplateData extends CompilePrintTemplateData {
  preview_data?: Record<string, any>;
  strict_variables?: boolean;
}

export interface PrintTemplateCompilePreviewResponse extends PrintTemplateCompileResponse {
  rendered_html?: string;
}

/**
 * 获取打印模板列表
 */
export async function getPrintTemplateList(params?: PrintTemplateListParams): Promise<PrintTemplate[]> {
  return apiRequest<PrintTemplate[]>('/core/print-templates', {
    params,
  });
}

/**
 * 获取打印模板详情
 */
export async function getPrintTemplateByUuid(printTemplateUuid: string): Promise<PrintTemplate> {
  return apiRequest<PrintTemplate>(`/core/print-templates/${printTemplateUuid}`);
}

/**
 * 创建打印模板
 */
export async function createPrintTemplate(data: CreatePrintTemplateData): Promise<PrintTemplate> {
  return apiRequest<PrintTemplate>('/core/print-templates', {
    method: 'POST',
    data,
  });
}

/**
 * 获取打印模板代码预览（带流水号，不占号）
 */
export async function getNextPrintTemplateCode(baseCode: string): Promise<NextPrintTemplateCodeResponse> {
  return apiRequest<NextPrintTemplateCodeResponse>('/core/print-templates/next-code', {
    params: { base_code: baseCode },
  });
}

/**
 * 加载系统打印模板预设（按已安装功能自动过滤）
 */
export async function loadPresetPrintTemplates(): Promise<LoadPresetPrintTemplateResponse> {
  return apiRequest<LoadPresetPrintTemplateResponse>('/core/print-templates/load-preset', {
    method: 'POST',
  });
}

/**
 * 更新打印模板
 */
export async function updatePrintTemplate(printTemplateUuid: string, data: UpdatePrintTemplateData): Promise<PrintTemplate> {
  return apiRequest<PrintTemplate>(`/core/print-templates/${printTemplateUuid}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除打印模板
 */
export async function deletePrintTemplate(printTemplateUuid: string): Promise<void> {
  return apiRequest<void>(`/core/print-templates/${printTemplateUuid}`, {
    method: 'DELETE',
  });
}

/**
 * 渲染打印模板
 */
export async function renderPrintTemplate(printTemplateUuid: string, data: RenderPrintTemplateData): Promise<PrintTemplateRenderResponse> {
  return apiRequest<PrintTemplateRenderResponse>(`/core/print-templates/${printTemplateUuid}/render`, {
    method: 'POST',
    data,
  });
}

/**
 * 编译可视化模板 schema
 */
export async function compilePrintTemplate(data: CompilePrintTemplateData): Promise<PrintTemplateCompileResponse> {
  return apiRequest<PrintTemplateCompileResponse>('/core/print-templates/compile', {
    method: 'POST',
    data,
  });
}

/**
 * 编译并预览可视化模板 schema
 */
export async function compilePreviewPrintTemplate(data: CompilePreviewPrintTemplateData): Promise<PrintTemplateCompilePreviewResponse> {
  return apiRequest<PrintTemplateCompilePreviewResponse>('/core/print-templates/compile-preview', {
    method: 'POST',
    data,
  });
}

