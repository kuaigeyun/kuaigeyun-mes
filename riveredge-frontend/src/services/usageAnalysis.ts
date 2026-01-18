/**
 * 使用情况分析服务
 * 
 * 提供使用情况分析的API调用
 * 
 * @author Luigi Lu
 * @date 2026-01-27
 */

import { apiRequest } from './api';

/**
 * 功能使用情况
 */
export interface FunctionUsage {
  function_name: string;
  function_code: string;
  usage_count: number;
  user_count: number;
  avg_duration: number;
  last_used: string;
}

/**
 * 功能使用分析结果
 */
export interface FunctionUsageAnalysis {
  period: {
    start_date: string;
    end_date: string;
  };
  function_usage: FunctionUsage[];
  unused_functions: Array<{
    function_name: string;
    function_code: string;
    last_used: string | null;
    days_unused: number;
  }>;
  high_frequency_functions: FunctionUsage[];
  summary: {
    total_functions: number;
    total_usage_count: number;
    total_user_count: number;
    unused_count: number;
    high_frequency_count: number;
  };
}

/**
 * 数据质量分析结果
 */
export interface DataQualityAnalysis {
  completeness: {
    score: number;
    total_records: number;
    complete_records: number;
    incomplete_records: number;
  };
  accuracy: {
    score: number;
    total_records: number;
    accurate_records: number;
    inaccurate_records: number;
  };
  consistency: {
    score: number;
    total_records: number;
    consistent_records: number;
    inconsistent_records: number;
  };
  issues: Array<{
    type: string;
    description: string;
    severity: string;
    affected_count: number;
  }>;
  overall_score: number;
}

/**
 * 性能分析结果
 */
export interface PerformanceAnalysis {
  period: {
    start_date: string;
    end_date: string;
  };
  response_time: {
    avg: number;
    p95: number;
    p99: number;
    max: number;
  };
  concurrency: {
    avg: number;
    max: number;
    peak_time: string;
  };
  resource_usage: {
    cpu_usage: number;
    memory_usage: number;
    disk_usage: number;
  };
  issues: Array<{
    type: string;
    description: string;
    severity: string;
    occurrence_count: number;
  }>;
}

/**
 * 使用情况分析报告
 */
export interface UsageReport {
  generated_at: string;
  function_usage: FunctionUsageAnalysis;
  data_quality: DataQualityAnalysis;
  performance: PerformanceAnalysis;
  summary: {
    function_usage_summary: any;
    data_quality_score: number;
    performance_issues_count: number;
  };
}

/**
 * 分析功能使用情况
 * 
 * @param startDate - 开始日期（可选）
 * @param endDate - 结束日期（可选）
 * @returns 功能使用分析结果
 */
export async function analyzeFunctionUsage(
  startDate?: string,
  endDate?: string
): Promise<FunctionUsageAnalysis> {
  const params: any = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  
  const response = await apiRequest('/api/v1/core/usage-analysis/function-usage', {
    method: 'GET',
    params,
  });
  return response.data || response;
}

/**
 * 分析数据质量
 * 
 * @returns 数据质量分析结果
 */
export async function analyzeDataQuality(): Promise<DataQualityAnalysis> {
  const response = await apiRequest('/api/v1/core/usage-analysis/data-quality', { method: 'GET' });
  return response.data || response;
}

/**
 * 分析系统性能
 * 
 * @param startDate - 开始日期（可选）
 * @param endDate - 结束日期（可选）
 * @returns 性能分析结果
 */
export async function analyzePerformance(
  startDate?: string,
  endDate?: string
): Promise<PerformanceAnalysis> {
  const params: any = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  
  const response = await apiRequest('/api/v1/core/usage-analysis/performance', {
    method: 'GET',
    params,
  });
  return response.data || response;
}

/**
 * 生成使用情况分析报告
 * 
 * @returns 使用情况分析报告
 */
export async function generateUsageReport(): Promise<UsageReport> {
  const response = await apiRequest('/api/v1/core/usage-analysis/report', { method: 'GET' });
  return response.data || response;
}
