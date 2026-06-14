/**
 * 代工来料（客户来料登记）相关服务
 */

import { apiRequest } from '../../../services/api';

export const customerMaterialRegistrationApi = {
  parseBarcode: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/inventory/customer-material-registration/parse-barcode', {
      method: 'POST',
      data,
    });
  },

  create: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/inventory/customer-material-registration', {
      method: 'POST',
      data,
    });
  },

  createAndStartProduction: async (data: any) => {
    return apiRequest('/apps/kuaizhizao/inventory/customer-material-registration/create-and-start-production', {
      method: 'POST',
      data,
    });
  },

  update: async (id: string, data: any) => {
    return apiRequest(`/apps/kuaizhizao/inventory/customer-material-registration/${id}`, {
      method: 'PUT',
      data,
    });
  },

  list: async (params?: any) => {
    return apiRequest('/apps/kuaizhizao/inventory/customer-material-registration', {
      method: 'GET',
      params,
    });
  },

  get: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/inventory/customer-material-registration/${id}`, {
      method: 'GET',
    });
  },

  delete: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/inventory/customer-material-registration/${id}`, {
      method: 'DELETE',
    });
  },

  process: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/inventory/customer-material-registration/${id}/process`, {
      method: 'POST',
    });
  },

  withdraw: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/inventory/customer-material-registration/${id}/withdraw`, {
      method: 'POST',
    });
  },

  cancel: async (id: string) => {
    return apiRequest(`/apps/kuaizhizao/inventory/customer-material-registration/${id}/cancel`, {
      method: 'POST',
    });
  },

  batchProcess: async (ids: Array<string | number>) => {
    return apiRequest('/apps/kuaizhizao/inventory/customer-material-registration/batch-process', {
      method: 'POST',
      data: { ids: ids.map((id) => Number(id)) },
    });
  },

  batchWithdraw: async (ids: Array<string | number>) => {
    return apiRequest('/apps/kuaizhizao/inventory/customer-material-registration/batch-withdraw', {
      method: 'POST',
      data: { ids: ids.map((id) => Number(id)) },
    });
  },

  batchCancel: async (ids: Array<string | number>) => {
    return apiRequest('/apps/kuaizhizao/inventory/customer-material-registration/batch-cancel', {
      method: 'POST',
      data: { ids: ids.map((id) => Number(id)) },
    });
  },

  batchDelete: async (ids: Array<string | number>) => {
    return apiRequest('/apps/kuaizhizao/inventory/customer-material-registration/batch-delete', {
      method: 'POST',
      data: { ids: ids.map((id) => Number(id)) },
    });
  },
};
