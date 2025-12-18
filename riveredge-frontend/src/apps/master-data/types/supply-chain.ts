/**
 * 供应链数据类型定义
 * 
 * 定义客户、供应商的数据类型
 */

export interface Customer {
  id: number;
  uuid: string;
  tenantId: number;
  code: string;
  name: string;
  shortName?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  category?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface CustomerCreate {
  code: string;
  name: string;
  shortName?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  category?: string;
  isActive?: boolean;
}

export interface CustomerUpdate {
  code?: string;
  name?: string;
  shortName?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  category?: string;
  isActive?: boolean;
}

export interface CustomerListParams {
  skip?: number;
  limit?: number;
  category?: string;
  isActive?: boolean;
}

export interface Supplier {
  id: number;
  uuid: string;
  tenantId: number;
  code: string;
  name: string;
  shortName?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  category?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface SupplierCreate {
  code: string;
  name: string;
  shortName?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  category?: string;
  isActive?: boolean;
}

export interface SupplierUpdate {
  code?: string;
  name?: string;
  shortName?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  category?: string;
  isActive?: boolean;
}

export interface SupplierListParams {
  skip?: number;
  limit?: number;
  category?: string;
  isActive?: boolean;
}

