/**
 * 操作引导服务
 * 
 * 提供操作引导的配置和管理API调用
 * 
 * @author Luigi Lu
 * @date 2026-01-27
 */

import { apiRequest } from './api';

/**
 * 操作引导步骤
 */
export interface OperationGuideStep {
  step: number;
  target: string;
  title: string;
  description: string;
  placement?: string;
}

/**
 * 操作引导配置
 */
export interface OperationGuide {
  page_key: string;
  page_name: string;
  steps: OperationGuideStep[];
  updated_at?: string;
}

/**
 * 获取操作引导
 * 
 * @param pageKey - 页面标识
 * @returns 操作引导配置
 */
export async function getOperationGuide(pageKey: string): Promise<OperationGuide> {
  const response = await apiRequest(`/api/v1/core/operation-guide/${pageKey}`, { method: 'GET' });
  return response.data || response;
}

/**
 * 列出所有操作引导
 * 
 * @returns 操作引导配置列表
 */
export async function listOperationGuides(): Promise<OperationGuide[]> {
  const response = await apiRequest('/api/v1/core/operation-guide', { method: 'GET' });
  return response.data || response;
}

/**
 * 创建或更新操作引导
 * 
 * @param guide - 操作引导配置
 * @returns 操作引导配置
 */
export async function createOrUpdateOperationGuide(guide: OperationGuide): Promise<OperationGuide> {
  const response = await apiRequest('/api/v1/core/operation-guide', {
    method: 'POST',
    data: guide,
  });
  return response.data || response;
}
