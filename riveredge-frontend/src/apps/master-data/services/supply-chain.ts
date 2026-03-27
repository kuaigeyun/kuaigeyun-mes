/**
 * 供应链数据 API 服务
 * 
 * 提供客户、供应商的 API 调用方法
 */

import { api } from '../../../services/api';
import { getUserList } from '../../../services/user';
import type {
  Customer,
  CustomerCreate,
  CustomerUpdate,
  CustomerListParams,
  Supplier,
  SupplierCreate,
  SupplierUpdate,
  SupplierListParams,
} from '../types/supply-chain';

/**
 * 客户 API 服务
 */
export const customerApi = {
  /**
   * 创建客户
   */
  create: async (data: CustomerCreate): Promise<Customer> => {
    return api.post('/apps/master-data/supply-chain/customers', data);
  },

  /**
   * 获取客户列表
   */
  list: async (params?: CustomerListParams): Promise<Customer[]> => {
    return api.get('/apps/master-data/supply-chain/customers', { params });
  },

  /**
   * 获取客户详情
   */
  get: async (uuid: string): Promise<Customer> => {
    return api.get(`/apps/master-data/supply-chain/customers/${uuid}`);
  },

  /**
   * 更新客户
   */
  update: async (uuid: string, data: CustomerUpdate): Promise<Customer> => {
    return api.put(`/apps/master-data/supply-chain/customers/${uuid}`, data);
  },

  /**
   * 删除客户
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/supply-chain/customers/${uuid}`);
  },
};

/**
 * 供应商 API 服务
 */
export const supplierApi = {
  /**
   * 创建供应商
   */
  create: async (data: SupplierCreate): Promise<Supplier> => {
    return api.post('/apps/master-data/supply-chain/suppliers', data);
  },

  /**
   * 获取供应商列表
   */
  list: async (params?: SupplierListParams): Promise<Supplier[]> => {
    return api.get('/apps/master-data/supply-chain/suppliers', { params });
  },

  /**
   * 获取供应商详情
   */
  get: async (uuid: string): Promise<Supplier> => {
    return api.get(`/apps/master-data/supply-chain/suppliers/${uuid}`);
  },

  /**
   * 更新供应商
   */
  update: async (uuid: string, data: SupplierUpdate): Promise<Supplier> => {
    return api.put(`/apps/master-data/supply-chain/suppliers/${uuid}`, data);
  },

  /**
   * 删除供应商
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/supply-chain/suppliers/${uuid}`);
  },
};

/**
 * 获取用户选项列表（供 Schema Form 使用）
 */
export const getUserOptions = async () => {
  try {
    const res = await getUserList({ page: 1, page_size: 1000, is_active: true });
    return res.items.map((user: any) => ({
      label: user.full_name || user.username,
      value: user.id || user.uuid, // 后端 salesman_id 是 int，所以优先用 id
    }));
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return [];
  }
};

