/**
 * 优化建议推送服务
 * 
 * 提供优化建议的API调用
 * 
 * @author Luigi Lu
 * @date 2026-01-27
 */

import { apiRequest } from './api';

/**
 * 优化建议
 */
export interface OptimizationSuggestion {
  type: string;
  category: string;
  title: string;
  description: string;
  priority: string;
  action: string;
  related_data?: any;
}

/**
 * 获取优化建议
 * 
 * @param category - 分类（可选）
 * @param priority - 优先级（可选）
 * @returns 优化建议列表
 */
export async function getSuggestions(
  category?: string,
  priority?: string
): Promise<OptimizationSuggestion[]> {
  const params: any = {};
  if (category) params.category = category;
  if (priority) params.priority = priority;
  
  const response = await apiRequest('/api/v1/core/optimization-suggestion/suggestions', {
    method: 'GET',
    params,
  });
  return response.data || response;
}

/**
 * 按分类获取优化建议
 * 
 * @param category - 分类（可选）
 * @returns 按分类的建议列表
 */
export async function getSuggestionsByCategory(
  category?: string
): Promise<Record<string, OptimizationSuggestion[]>> {
  const params: any = {};
  if (category) params.category = category;
  
  const response = await apiRequest('/api/v1/core/optimization-suggestion/suggestions/by-category', {
    method: 'GET',
    params,
  });
  return response.data || response;
}

/**
 * 按优先级获取优化建议
 * 
 * @param priority - 优先级（可选）
 * @returns 按优先级的建议列表
 */
export async function getSuggestionsByPriority(
  priority?: string
): Promise<Record<string, OptimizationSuggestion[]>> {
  const params: any = {};
  if (priority) params.priority = priority;
  
  const response = await apiRequest('/api/v1/core/optimization-suggestion/suggestions/by-priority', {
    method: 'GET',
    params,
  });
  return response.data || response;
}
