/**
 * 组装模板相关服务
 */

import { apiRequest } from '../../../services/api';

export const assemblyTemplateApi = {
  list: async (params?: Record<string, unknown>) => {
    return apiRequest('/apps/kuaizhizao/assembly-templates', { method: 'GET', params });
  },
  create: async (data: Record<string, unknown>) => {
    return apiRequest('/apps/kuaizhizao/assembly-templates', { method: 'POST', data });
  },
  update: async (id: string, data: Record<string, unknown>) => {
    return apiRequest(`/apps/kuaizhizao/assembly-templates/${id}`, { method: 'PUT', data });
  },
  get: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/assembly-templates/${id}`, { method: 'GET' });
  },
  delete: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/assembly-templates/${id}`, { method: 'DELETE' });
  },
  createItem: async (templateId: string, data: Record<string, unknown>) => {
    return apiRequest(`/apps/kuaizhizao/assembly-templates/${templateId}/items`, { method: 'POST', data });
  },
  updateItem: async (templateId: string, itemId: string, data: Record<string, unknown>) => {
    return apiRequest(`/apps/kuaizhizao/assembly-templates/${templateId}/items/${itemId}`, {
      method: 'PUT',
      data,
    });
  },
  deleteItem: async (templateId: string, itemId: string) => {
    return apiRequest(`/apps/kuaizhizao/assembly-templates/${templateId}/items/${itemId}`, {
      method: 'DELETE',
    });
  },
  bomPreview: async (params: Record<string, unknown>) => {
    return apiRequest('/apps/kuaizhizao/assembly-templates/bom-preview', { method: 'GET', params });
  },
  importFromBom: async (templateId: string) => {
    return apiRequest(`/apps/kuaizhizao/assembly-templates/${templateId}/import-from-bom`, {
      method: 'POST',
    });
  },
};
