/**
 * KU-AI 智能建议服务
 *
 * 提供智能建议相关的 API 接口。
 * API 路径：/apps/kuaiai/suggestions
 */

import { apiRequest } from '../../../services/api';

const SUGGESTIONS_BASE = '/apps/kuaiai/suggestions';

/**
 * 获取建议列表
 */
export async function getSuggestions(scene: string, context?: any) {
  const params: any = {};
  if (context) {
    params.context = JSON.stringify(context);
  }
  return apiRequest(`${SUGGESTIONS_BASE}/${scene}`, {
    method: 'GET',
    params,
  });
}

/**
 * 获取工单相关建议
 */
export async function getWorkOrderSuggestions(workOrderId: number) {
  return apiRequest(`${SUGGESTIONS_BASE}/work-order/${workOrderId}`, {
    method: 'GET',
  });
}

/**
 * 获取报工相关建议
 */
export async function getReportingSuggestions(reportingId: number) {
  return apiRequest(`${SUGGESTIONS_BASE}/reporting/${reportingId}`, {
    method: 'GET',
  });
}

/**
 * 获取库存相关建议
 */
export async function getInventorySuggestions() {
  return apiRequest(`${SUGGESTIONS_BASE}/inventory/all`, {
    method: 'GET',
  });
}

/**
 * 获取生产看板相关建议
 */
export async function getProductionSuggestions() {
  return apiRequest(`${SUGGESTIONS_BASE}/production/all`, {
    method: 'GET',
  });
}
