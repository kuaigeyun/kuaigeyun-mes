/**
 * 数据质量保障服务
 * 
 * 提供数据验证、数据清洗建议、数据质量报告等API调用
 * 
 * @author Luigi Lu
 * @date 2026-01-27
 */

import { apiRequest } from './api';

/**
 * 验证问题
 */
export interface ValidationIssue {
  row_index: number;
  field: string;
  issue_type: 'error' | 'warning';
  message: string;
  suggestion?: string;
}

/**
 * 验证报告
 */
export interface ValidationReport {
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  warning_rows: number;
  is_valid: boolean;
  issues: ValidationIssue[];
}

/**
 * 数据清洗建议
 */
export interface DataCleaningSuggestion {
  issue_type: 'duplicate' | 'anomaly' | 'missing' | 'format';
  description: string;
  affected_rows: number[];
  suggestion: string;
  auto_fixable: boolean;
}

/**
 * 数据质量报告
 */
export interface DataQualityReport {
  completeness: number;
  accuracy: number;
  consistency: number;
  issues: ValidationIssue[];
  suggestions: DataCleaningSuggestion[];
  generated_at: string;
}

/**
 * 数据验证请求
 */
export interface DataValidationRequest {
  data: any[][];
  headers: string[];
  field_rules?: Record<string, Record<string, any>>;
  required_fields?: string[];
  reference_data?: Record<string, string[]>;
}

/**
 * 数据清洗检测请求
 */
export interface DataCleaningRequest {
  data: any[][];
  headers: string[];
  key_fields?: string[];
}

/**
 * 数据验证（导入前）
 * 
 * @param request - 数据验证请求
 * @returns 验证报告
 */
export async function validateData(request: DataValidationRequest): Promise<ValidationReport> {
  const response = await apiRequest('/api/v1/core/data-quality/validate', {
    method: 'POST',
    data: request,
  });
  return response.data || response;
}

/**
 * 检测数据问题
 * 
 * @param request - 数据清洗检测请求
 * @returns 数据清洗建议列表
 */
export async function detectDataIssues(request: DataCleaningRequest): Promise<DataCleaningSuggestion[]> {
  const response = await apiRequest('/api/v1/core/data-quality/detect-issues', {
    method: 'POST',
    data: request,
  });
  return (response.data?.suggestions || response.suggestions || []) as DataCleaningSuggestion[];
}

/**
 * 生成数据质量报告
 * 
 * @param validationRequest - 数据验证请求
 * @param cleaningRequest - 数据清洗检测请求（可选）
 * @returns 数据质量报告
 */
export async function generateQualityReport(
  validationRequest: DataValidationRequest,
  cleaningRequest?: DataCleaningRequest
): Promise<DataQualityReport> {
  const response = await apiRequest('/api/v1/core/data-quality/quality-report', {
    method: 'POST',
    data: {
      validation_request: validationRequest,
      cleaning_request: cleaningRequest,
    },
  });
  return response.data || response;
}
