/**
 * 供应链数据类型定义
 * 
 * 定义客户、供应商的数据类型
 */

/** 开票资料与商事/结算/联系人扩展（客户、供应商共用字段） */
export interface PartnerInvoiceAndExtendedFields {
  taxRegistrationNo?: string;
  invoiceTitle?: string;
  invoiceAddress?: string;
  invoicePhone?: string;
  invoiceBankName?: string;
  invoiceBankAccount?: string;
  invoiceTypeCode?: string;
  taxpayerTypeCode?: string;
  legalRepresentative?: string;
  enterpriseTypeCode?: string;
  paymentTermsDays?: number | string | null;
  settlementMethodCode?: string;
  financeContactName?: string;
  financeContactPhone?: string;
  financeContactEmail?: string;
  deliveryContactName?: string;
  deliveryContactPhone?: string;
  deliveryAddress?: string;
}

export interface PartnerContact {
  contactPerson?: string;
  contactTitle?: string;
  phone?: string;
  email?: string;
}

/** @deprecated 使用 PartnerContact */
export type CustomerContact = PartnerContact;

export interface Customer extends PartnerInvoiceAndExtendedFields {
  id: number;
  uuid: string;
  tenantId: number;
  code: string;
  name: string;
  shortName?: string;
  /** 首条联系人快照（列表/检索）；明细以 contacts 为准 */
  contactPerson?: string;
  contactTitle?: string;
  phone?: string;
  email?: string;
  contacts?: CustomerContact[];
  address?: string;
  category?: string;
  industryCode?: string;
  customerLevelCode?: string;
  leadSourceCode?: string;
  estimatedAnnualPurchase?: number | string;
  creditLimit?: number | string;
  /** 应收确认策略覆盖，空=跟随组织参数中心 */
  revenueRecognitionOverride?: string | null;
  salesmanId?: number;
  salesmanName?: string;
  poolStatus?: 'pool' | 'owned' | string;
  assignedAt?: string;
  lastFollowUpAt?: string;
  recycleAt?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface CustomerCreate extends PartnerInvoiceAndExtendedFields {
  code: string;
  name: string;
  shortName?: string;
  contacts?: PartnerContact[];
  address?: string;
  category?: string;
  industryCode?: string;
  customerLevelCode?: string;
  leadSourceCode?: string;
  estimatedAnnualPurchase?: number;
  creditLimit?: number;
  revenueRecognitionOverride?: string | null;
  salesmanId?: number;
  isActive?: boolean;
}

export interface CustomerUpdate extends PartnerInvoiceAndExtendedFields {
  code?: string;
  name?: string;
  shortName?: string;
  contacts?: PartnerContact[];
  address?: string;
  category?: string;
  industryCode?: string;
  customerLevelCode?: string;
  leadSourceCode?: string;
  estimatedAnnualPurchase?: number;
  creditLimit?: number;
  revenueRecognitionOverride?: string | null;
  salesmanId?: number | null;
  isActive?: boolean;
}

export interface CustomerListParams {
  skip?: number;
  limit?: number;
  category?: string;
  isActive?: boolean;
  keyword?: string;
  salesmanId?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/** 客户列表分页响应 */
export interface CustomerListResponse {
  data: Customer[];
  total: number;
}

export interface Supplier extends PartnerInvoiceAndExtendedFields {
  id: number;
  uuid: string;
  tenantId: number;
  code: string;
  name: string;
  shortName?: string;
  /** 首条联系人快照（列表/检索）；明细以 contacts 为准 */
  contactPerson?: string;
  contactTitle?: string;
  phone?: string;
  email?: string;
  contacts?: PartnerContact[];
  address?: string;
  category?: string;
  industryCode?: string;
  sourceChannelCode?: string;
  estimatedAnnualPurchase?: number | string;
  creditLimit?: number | string;
  /** 应付确认策略覆盖，空=跟随组织参数中心 */
  payableRecognitionOverride?: string | null;
  buyerId?: number;
  buyerName?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface SupplierCreate extends PartnerInvoiceAndExtendedFields {
  code: string;
  name: string;
  shortName?: string;
  contacts?: PartnerContact[];
  address?: string;
  category?: string;
  industryCode?: string;
  sourceChannelCode?: string;
  estimatedAnnualPurchase?: number;
  creditLimit?: number;
  payableRecognitionOverride?: string | null;
  buyerId?: number;
  buyerName?: string;
  isActive?: boolean;
}

export interface SupplierUpdate extends PartnerInvoiceAndExtendedFields {
  code?: string;
  name?: string;
  shortName?: string;
  contacts?: PartnerContact[];
  address?: string;
  category?: string;
  industryCode?: string;
  sourceChannelCode?: string;
  estimatedAnnualPurchase?: number;
  creditLimit?: number;
  payableRecognitionOverride?: string | null;
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
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SupplierListResponse {
  data: Supplier[];
  total: number;
}
