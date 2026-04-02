/**
 * 样品试用单 API
 */

import { apiRequest } from '../../../services/api';

export const sampleTrialApi = {
  list: async (params?: any) => apiRequest('/apps/kuaizhizao/sample-trials', { method: 'GET', params }),
  create: async (data: any) => apiRequest('/apps/kuaizhizao/sample-trials', { method: 'POST', data }),
  update: async (id: string, data: any) => apiRequest(`/apps/kuaizhizao/sample-trials/${id}`, { method: 'PUT', data }),
  delete: async (id: string) => apiRequest(`/apps/kuaizhizao/sample-trials/${id}`, { method: 'DELETE' }),
  get: async (id: string) => apiRequest(`/apps/kuaizhizao/sample-trials/${id}`, { method: 'GET' }),
  submit: async (id: string) => apiRequest(`/apps/kuaizhizao/sample-trials/${id}/submit`, { method: 'POST' }),
  withdraw: async (id: string) => apiRequest(`/apps/kuaizhizao/sample-trials/${id}/withdraw`, { method: 'POST' }),
  approve: async (id: string, body?: { review_remarks?: string }) =>
    apiRequest(`/apps/kuaizhizao/sample-trials/${id}/approve`, { method: 'POST', data: body ?? {} }),
  reject: async (id: string, body?: { review_remarks?: string }) =>
    apiRequest(`/apps/kuaizhizao/sample-trials/${id}/reject`, { method: 'POST', data: body ?? {} }),
  convertToOrder: async (id: string) =>
    apiRequest(`/apps/kuaizhizao/sample-trials/${id}/convert-to-order`, { method: 'POST' }),
  createOutbound: async (id: string, body: { warehouse_id: number; warehouse_name: string }) =>
    apiRequest(`/apps/kuaizhizao/sample-trials/${id}/create-outbound`, { method: 'POST', data: body }),
  print: async (id: string, templateUuid?: string) =>
    apiRequest(`/apps/kuaizhizao/sample-trials/${id}/print`, {
      method: 'GET',
      params: templateUuid ? { template_uuid: templateUuid } : undefined,
    }),
};
