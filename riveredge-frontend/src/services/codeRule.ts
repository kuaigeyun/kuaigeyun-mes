/**
 * 编码规则 API 服务
 * 
 * 提供编码规则管理相关的 API 接口
 * 注意：所有 API 自动过滤当前组织的编码规则
 */

import { apiRequest } from './api';

/**
 * 编码规则信息接口
 */
export interface CodeRule {
  uuid: string;
  name: string;
  code: string;
  expression: string;
  description?: string;
  seq_start: number;
  seq_step: number;
  seq_reset_rule?: 'never' | 'daily' | 'monthly' | 'yearly';
  is_system: boolean;
  is_active: boolean;
  allow_manual_edit?: boolean;
  tenant_id: number;
  created_at: string;
  updated_at: string;
}

/**
 * 编码规则列表查询参数
 */
export interface CodeRuleListParams {
  page?: number;
  page_size?: number;
  is_active?: boolean;
}

/**
 * 编码规则列表响应数据
 */
export interface CodeRuleListResponse {
  items: CodeRule[];
  total: number;
}

/**
 * 创建编码规则数据
 */
export interface CreateCodeRuleData {
  name: string;
  code: string;
  expression: string;
  description?: string;
  seq_start?: number;
  seq_step?: number;
  seq_reset_rule?: 'never' | 'daily' | 'monthly' | 'yearly';
  is_system?: boolean;
  is_active?: boolean;
}

/**
 * 更新编码规则数据
 */
export interface UpdateCodeRuleData {
  name?: string;
  expression?: string;
  description?: string;
  seq_start?: number;
  seq_step?: number;
  seq_reset_rule?: 'never' | 'daily' | 'monthly' | 'yearly';
  is_active?: boolean;
}

/**
 * 编码生成请求数据
 */
export interface CodeGenerationRequest {
  rule_code: string;
  context?: Record<string, any>;
  check_duplicate?: boolean; // 是否检查重复（如果为True，会自动递增直到找到不重复的编码）
  entity_type?: string; // 实体类型（如：'material'，用于检查重复）
}

/**
 * 编码生成响应数据
 */
export interface CodeGenerationResponse {
  code: string;
  rule_name: string;
}

/**
 * 获取编码规则列表
 * 
 * 自动过滤当前组织的编码规则。
 * 注意：后端返回的是 List[CodeRuleResponse]（数组），需要转换为分页格式。
 * 
 * @param params - 查询参数
 * @returns 编码规则列表响应数据
 */
export async function getCodeRuleList(params?: CodeRuleListParams): Promise<CodeRuleListResponse> {
  // 后端 API 使用 skip 和 limit 参数，而不是 page 和 page_size
  const queryParams: any = {};
  if (params?.page && params?.page_size) {
    queryParams.skip = (params.page - 1) * params.page_size;
    queryParams.limit = params.page_size;
  }
  if (params?.is_active !== undefined) {
    queryParams.is_active = params.is_active;
  }
  
  // 后端返回的是数组，需要转换为分页格式
  const response = await apiRequest<CodeRule[]>('/core/code-rules', {
    params: queryParams,
  });
  
  // 如果是数组，转换为分页格式
  if (Array.isArray(response)) {
    return {
      items: response,
      total: response.length,
    };
  }
  
  // 如果已经是分页格式，直接返回
  if (response && typeof response === 'object' && 'items' in response) {
    return response as CodeRuleListResponse;
  }
  
  // 默认返回空列表
  return {
    items: [],
    total: 0,
  };
}

/**
 * 获取编码规则详情
 * 
 * 自动验证组织权限：只能获取当前组织的编码规则。
 * 
 * @param ruleUuid - 编码规则 UUID
 * @returns 编码规则信息
 */
export async function getCodeRuleByUuid(ruleUuid: string): Promise<CodeRule> {
  return apiRequest<CodeRule>(`/core/code-rules/${ruleUuid}`);
}

/**
 * 创建编码规则
 * 
 * 自动设置当前组织的 tenant_id。
 * 
 * @param data - 编码规则创建数据
 * @returns 创建的编码规则信息
 */
export async function createCodeRule(data: CreateCodeRuleData): Promise<CodeRule> {
  return apiRequest<CodeRule>('/core/code-rules', {
    method: 'POST',
    data,
  });
}

/**
 * 更新编码规则
 * 
 * 自动验证组织权限：只能更新当前组织的编码规则。
 * 
 * @param ruleUuid - 编码规则 UUID
 * @param data - 编码规则更新数据
 * @returns 更新后的编码规则信息
 */
export async function updateCodeRule(ruleUuid: string, data: UpdateCodeRuleData): Promise<CodeRule> {
  return apiRequest<CodeRule>(`/core/code-rules/${ruleUuid}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除编码规则
 * 
 * 自动验证组织权限：只能删除当前组织的编码规则。
 * 系统规则不可删除。
 * 
 * @param ruleUuid - 编码规则 UUID
 */
export async function deleteCodeRule(ruleUuid: string): Promise<void> {
  return apiRequest<void>(`/core/code-rules/${ruleUuid}`, {
    method: 'DELETE',
  });
}

/**
 * 生成编码（会更新序号）
 * 
 * @param request - 编码生成请求数据
 * @returns 生成的编码
 */
export async function generateCode(request: CodeGenerationRequest): Promise<CodeGenerationResponse> {
  return apiRequest<CodeGenerationResponse>('/core/code-rules/generate', {
    method: 'POST',
    data: request,
  });
}

/**
 * 测试生成编码（不更新序号）
 * 
 * @param request - 编码生成请求数据
 * @returns 生成的编码（测试用）
 */
export async function testGenerateCode(request: CodeGenerationRequest): Promise<CodeGenerationResponse> {
  return apiRequest<CodeGenerationResponse>('/core/code-rules/test-generate', {
    method: 'POST',
    data: request,
  });
}

/**
 * 编码规则页面配置接口（后端返回格式，snake_case）
 */
export interface CodeRulePageConfigResponse {
  page_code: string;
  page_name: string;
  page_path: string;
  code_field: string;
  code_field_label: string;
  module: string;
  module_icon?: string;
  auto_generate?: boolean;
  rule_code?: string;
  allow_manual_edit?: boolean;
  available_fields?: Array<{
    field_name: string;
    field_label: string;
    field_type: string;
    description?: string;
  }>;
}

/**
 * 编码规则页面配置接口（前端使用格式，camelCase）
 */
export interface CodeRulePageConfig {
  pageCode: string;
  pageName: string;
  pagePath: string;
  codeField: string;
  codeFieldLabel: string;
  module: string;
  moduleIcon?: string;
  autoGenerate?: boolean;
  ruleCode?: string;
  allowManualEdit?: boolean;
  availableFields?: Array<{
    fieldName: string;
    fieldLabel: string;
    fieldType: string;
    description?: string;
  }>;
}

/**
 * 获取编码规则功能页面配置列表
 * 
 * 返回系统中所有有编码字段的功能页面配置。
 * 
 * @returns 功能页面配置列表（已转换为camelCase格式）
 */
export async function getCodeRulePages(): Promise<CodeRulePageConfig[]> {
  const pages = await apiRequest<CodeRulePageConfigResponse[]>('/core/code-rules/pages');
  // 转换字段名从 snake_case 到 camelCase
  return pages.map(page => ({
    pageCode: page.page_code,
    pageName: page.page_name,
    pagePath: page.page_path,
    codeField: page.code_field,
    codeFieldLabel: page.code_field_label,
    module: page.module,
    moduleIcon: page.module_icon,
    autoGenerate: page.auto_generate ?? false,
    ruleCode: page.rule_code,
    allowManualEdit: page.allow_manual_edit ?? true,
    availableFields: page.available_fields?.map(field => ({
      fieldName: field.field_name,
      fieldLabel: field.field_label,
      fieldType: field.field_type,
      description: field.description,
    })),
  }));
}

/**
 * 获取指定页面的编码规则配置
 * 
 * 根据页面代码获取编码规则配置，包括是否自动生成、是否允许手动填写等。
 * 
 * @param pageCode - 页面代码（如：kuaizhizao-sales-order）
 * @returns 页面编码规则配置（已转换为camelCase格式）
 */
export async function getCodeRulePageConfig(pageCode: string): Promise<CodeRulePageConfig | null> {
  try {
    const page = await apiRequest<CodeRulePageConfigResponse>(`/core/code-rules/pages/${pageCode}`);
    // 转换字段名从 snake_case 到 camelCase
    return {
      pageCode: page.page_code,
      pageName: page.page_name,
      pagePath: page.page_path,
      codeField: page.code_field,
      codeFieldLabel: page.code_field_label,
      module: page.module,
      moduleIcon: page.module_icon,
      autoGenerate: page.auto_generate ?? false,
      ruleCode: page.rule_code,
      allowManualEdit: page.allow_manual_edit ?? true,
      availableFields: page.available_fields?.map(field => ({
        fieldName: field.field_name,
        fieldLabel: field.field_label,
        fieldType: field.field_type,
        description: field.description,
      })),
    };
  } catch (error) {
    console.error('获取页面编码规则配置失败:', error);
    return null;
  }
}
