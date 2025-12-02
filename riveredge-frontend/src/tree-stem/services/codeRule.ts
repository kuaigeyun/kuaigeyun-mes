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
 * 
 * @param params - 查询参数
 * @returns 编码规则列表响应数据
 */
export async function getCodeRuleList(params?: CodeRuleListParams): Promise<CodeRuleListResponse> {
  return apiRequest<CodeRuleListResponse>('/system/code-rules', {
    params,
  });
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
  return apiRequest<CodeRule>(`/system/code-rules/${ruleUuid}`);
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
  return apiRequest<CodeRule>('/system/code-rules', {
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
  return apiRequest<CodeRule>(`/system/code-rules/${ruleUuid}`, {
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
  return apiRequest<void>(`/system/code-rules/${ruleUuid}`, {
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
  return apiRequest<CodeGenerationResponse>('/system/code-rules/generate', {
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
  return apiRequest<CodeGenerationResponse>('/system/code-rules/test-generate', {
    method: 'POST',
    data: request,
  });
}

