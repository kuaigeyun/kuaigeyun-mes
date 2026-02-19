/**
 * 报工与物料绑定 API
 */

import { apiRequest } from '../../../services/api';

export const reportingApi = {
  list: async (params?: any) => apiRequest('/apps/kuaizhizao/reporting', { method: 'GET', params }),
  create: async (data: any) => apiRequest('/apps/kuaizhizao/reporting', { method: 'POST', data }),
  update: async (id: string, data: any) => apiRequest(`/apps/kuaizhizao/reporting/${id}`, { method: 'PUT', data }),
  delete: async (id: string) => apiRequest(`/apps/kuaizhizao/reporting/${id}`, { method: 'DELETE' }),
  get: async (id: string) => apiRequest(`/apps/kuaizhizao/reporting/${id}`, { method: 'GET' }),
  approve: async (id: string, data?: any, params?: { rejection_reason?: string }) =>
    apiRequest(`/apps/kuaizhizao/reporting/${id}/approve`, { method: 'POST', data: data || {}, params }),
  getStatistics: async (params?: any) => apiRequest('/apps/kuaizhizao/reporting/statistics', { method: 'GET', params }),
  recordScrap: async (recordId: string, data: any) =>
    apiRequest(`/apps/kuaizhizao/reporting/${recordId}/scrap`, { method: 'POST', data }),
  recordDefect: async (recordId: string, data: any) =>
    apiRequest(`/apps/kuaizhizao/reporting/${recordId}/defect`, { method: 'POST', data }),
  correct: async (recordId: string, data: any) => {
    const { correction_reason, ...restData } = data;
    if (!correction_reason || !correction_reason.trim()) {
      throw new Error('修正原因不能为空');
    }
    return apiRequest(`/apps/kuaizhizao/reporting/${recordId}/correct`, {
      method: 'PUT',
      data: restData,
      params: { correction_reason },
    });
  },
};

export const materialBindingApi = {
  createFeeding: async (recordId: string, data: any) =>
    apiRequest(`/apps/kuaizhizao/reporting/${recordId}/material-binding/feeding`, { method: 'POST', data }),
  createDischarging: async (recordId: string, data: any) =>
    apiRequest(`/apps/kuaizhizao/reporting/${recordId}/material-binding/discharging`, { method: 'POST', data }),
  getByReportingRecord: async (recordId: string) =>
    apiRequest(`/apps/kuaizhizao/reporting/${recordId}/material-binding`, { method: 'GET' }),
  delete: async (bindingId: string) =>
    apiRequest(`/apps/kuaizhizao/material-binding/${bindingId}`, { method: 'DELETE' }),
};
