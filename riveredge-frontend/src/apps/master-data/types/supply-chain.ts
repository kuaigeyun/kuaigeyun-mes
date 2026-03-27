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
  contactTitle?: string;
  phone?: string;
  email?: string;
  address?: string;
  category?: string;
  industryCode?: string;
  customerLevelCode?: string;
  leadSourceCode?: string;
  estimatedAnnualPurchase?: number | string;
  creditLimit?: number | string;
  salesmanId?: number;
  salesmanName?: string;
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
  contactTitle?: string;
  phone?: string;
  email?: string;
  address?: string;
  category?: string;
  industryCode?: string;
  customerLevelCode?: string;
  leadSourceCode?: string;
  estimatedAnnualPurchase?: number;
  creditLimit?: number;
  salesmanId?: number;
  salesmanName?: string;
  isActive?: boolean;
}

export interface CustomerUpdate {
  code?: string;
  name?: string;
  shortName?: string;
  contactPerson?: string;
  contactTitle?: string;
  phone?: string;
  email?: string;
  address?: string;
  category?: string;
  industryCode?: string;
  customerLevelCode?: string;
  leadSourceCode?: string;
  estimatedAnnualPurchase?: number;
  creditLimit?: number;
  salesmanId?: number;
  salesmanName?: string;
  isActive?: boolean;
}

export interface CustomerListParams {
  skip?: number;
  limit?: number;
  category?: string;
  isActive?: boolean;
  keyword?: string;
  salesmanId?: number;
}

export interface Supplier {
  id: number;
  uuid: string;
  tenantId: number;
  code: string;
  name: string;
  shortName?: string;
  contactPerson?: string;
  contactTitle?: string;
  phone?: string;
  email?: string;
  address?: string;
  category?: string;
  industryCode?: string;
  supplierLevelCode?: string;
  sourceChannelCode?: string;
  estimatedAnnualPurchase?: number | string;
  creditLimit?: number | string;
  buyerId?: number;
  buyerName?: string;
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
  contactTitle?: string;
  phone?: string;
  email?: string;
  address?: string;
  category?: string;
  industryCode?: string;
  supplierLevelCode?: string;
  sourceChannelCode?: string;
  estimatedAnnualPurchase?: number;
  creditLimit?: number;
  buyerId?: number;
  buyerName?: string;
  isActive?: boolean;
}

export interface SupplierUpdate {
  code?: string;
  name?: string;
  shortName?: string;
  contactPerson?: string;
  contactTitle?: string;
  phone?: string;
  email?: string;
  address?: string;
  category?: string;
  industryCode?: string;
  supplierLevelCode?: string;
  sourceChannelCode?: string;
  estimatedAnnualPurchase?: number;
  creditLimit?: number;
  buyerId?: number;
  buyerName?: string;
  isActive?: boolean;
}

export interface SupplierListParams {
  skip?: number;
  limit?: number;
  category?: string;
  isActive?: boolean;
  keyword?: string;
  buyerId?: number;
  code?: string;
  name?: string;
}
