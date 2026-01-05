/**
 * AI智能建议服务
 *
 * 提供AI智能建议相关的API接口。
 *
 * Author: Luigi Lu
 * Date: 2026-01-05
 */

import { apiRequest } from './api';

/**
 * 获取建议列表
 */
export async function getSuggestions(scene: string, context?: any) {
  const params: any = {};
  if (context) {
    params.context = JSON.stringify(context);
  }
  return apiRequest(`/core/ai/suggestions/${scene}`, {
    method: 'GET',
    params,
  });
}

/**
 * 获取工单相关建议
 */
export async function getWorkOrderSuggestions(workOrderId: number) {
  return apiRequest(`/core/ai/suggestions/work-order/${workOrderId}`, {
    method: 'GET',
  });
}

/**
 * 获取报工相关建议
 */
export async function getReportingSuggestions(reportingId: number) {
  return apiRequest(`/core/ai/suggestions/reporting/${reportingId}`, {
    method: 'GET',
  });
}

/**
 * 获取库存相关建议
 */
export async function getInventorySuggestions() {
  return apiRequest('/core/ai/suggestions/inventory/all', {
    method: 'GET',
  });
}

/**
 * 获取生产看板相关建议
 */
export async function getProductionSuggestions() {
  return apiRequest('/core/ai/suggestions/production/all', {
    method: 'GET',
  });
}

