/**
 * 快制造 CRUD / 工作流单据 API 工厂（P3-D-C / C-01）
 * equipmentOps / moldOps / toolOps 共用，避免三处重复定义。
 */

import { apiRequest } from '../../../services/api';

/** 快制造应用 API 根路径（P3-D / X-01） */
export const KUAIZHIZAO_API_BASE = '/apps/kuaizhizao';

export function crudApi(basePath: string) {
  return {
    list: (params?: Record<string, unknown>) =>
      apiRequest(`${KUAIZHIZAO_API_BASE}/${basePath}`, { method: 'GET', params }),
    get: (id: number) =>
      apiRequest(`${KUAIZHIZAO_API_BASE}/${basePath}/${id}`, { method: 'GET' }),
    create: (data: unknown) =>
      apiRequest(`${KUAIZHIZAO_API_BASE}/${basePath}`, { method: 'POST', data }),
    update: (id: number, data: unknown) =>
      apiRequest(`${KUAIZHIZAO_API_BASE}/${basePath}/${id}`, { method: 'PUT', data }),
    delete: (id: number) =>
      apiRequest(`${KUAIZHIZAO_API_BASE}/${basePath}/${id}`, { method: 'DELETE' }),
  };
}

export function workflowDocApi(basePath: string) {
  return {
    ...crudApi(basePath),
    previewLines: (params: Record<string, unknown>) =>
      apiRequest(`${KUAIZHIZAO_API_BASE}/${basePath}/preview-lines`, {
        method: 'GET',
        params,
      }),
    submit: (id: number) =>
      apiRequest(`${KUAIZHIZAO_API_BASE}/${basePath}/${id}/submit`, { method: 'POST' }),
    approve: (id: number) =>
      apiRequest(`${KUAIZHIZAO_API_BASE}/${basePath}/${id}/approve`, { method: 'POST' }),
    reject: (id: number, data: { reject_reason: string }) =>
      apiRequest(`${KUAIZHIZAO_API_BASE}/${basePath}/${id}/reject`, {
        method: 'POST',
        data,
      }),
    complete: (id: number, data?: unknown) =>
      apiRequest(`${KUAIZHIZAO_API_BASE}/${basePath}/${id}/complete`, {
        method: 'POST',
        data,
      }),
  };
}
