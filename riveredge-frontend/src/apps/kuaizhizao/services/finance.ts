/**
 * 财务管理API服务
 *
 * 提供财务协同相关的API调用接口
 *
 * @author RiverEdge Team
 * @date 2025-12-29
 */

import { apiRequest } from '../../../services/api';

/**
 * 应付单接口定义
 */
export interface AccountsPayable {
  id?: number;
  payableCode?: string;
  purchaseOrderCode: string;
  supplierName: string;
  materialCode: string;
  totalAmount: number;
  taxRate: number;
  taxAmount: number;
  netAmount: number;
  currency: string;
  dueDate: string;
  status?: 'draft' | 'confirmed' | 'paid' | 'overdue';
  paymentMethod?: string;
  paymentDate?: string;
  remarks?: string;
}

export interface AccountsPayableListParams {
  skip?: number;
  limit?: number;
  status?: string;
  supplierName?: string;
  startDate?: string;
  endDate?: string;
  keyword?: string;
}

export interface AccountsPayableListResponse {
  data: AccountsPayable[];
  total: number;
  success: boolean;
}

/**
 * 应收单接口定义
 */
export interface AccountsReceivable {
  id?: number;
  receivableCode?: string;
  salesOrderCode?: string;
  customerName: string;
  productCode: string;
  totalAmount: number;
  taxRate: number;
  taxAmount: number;
  netAmount: number;
  currency: string;
  dueDate: string;
  status?: 'draft' | 'confirmed' | 'received' | 'overdue';
  paymentMethod?: string;
  paymentDate?: string;
  remarks?: string;
}

export interface AccountsReceivableListParams {
  skip?: number;
  limit?: number;
  status?: string;
  customerName?: string;
  salesOrderCode?: string;
  startDate?: string;
  endDate?: string;
  keyword?: string;
}

export interface AccountsReceivableListResponse {
  data: AccountsReceivable[];
  total: number;
  success: boolean;
}

// 应付管理API
export async function listAccountsPayable(params: AccountsPayableListParams = {}): Promise<AccountsPayableListResponse> {
  return apiRequest<AccountsPayableListResponse>({
    url: '/apps/kuaizhizao/payables',
    method: 'GET',
    params,
  });
}

export async function createAccountsPayable(data: AccountsPayable): Promise<AccountsPayable> {
  return apiRequest<AccountsPayable>({
    url: '/apps/kuaizhizao/payables',
    method: 'POST',
    data,
  });
}

export async function updateAccountsPayable(id: number, data: Partial<AccountsPayable>): Promise<AccountsPayable> {
  return apiRequest<AccountsPayable>({
    url: `/apps/kuaizhizao/payables/${id}`,
    method: 'PUT',
    data,
  });
}

export async function makePayment(id: number, paymentMethod: string, paymentDate: string, remarks?: string): Promise<AccountsPayable> {
  return apiRequest<AccountsPayable>({
    url: `/apps/kuaizhizao/payables/${id}/payment`,
    method: 'POST',
    data: { paymentMethod, paymentDate, remarks },
  });
}

// 应收管理API
export async function listAccountsReceivable(params: AccountsReceivableListParams = {}): Promise<AccountsReceivableListResponse> {
  return apiRequest<AccountsReceivableListResponse>({
    url: '/apps/kuaizhizao/receivables',
    method: 'GET',
    params,
  });
}

export async function createAccountsReceivable(data: AccountsReceivable): Promise<AccountsReceivable> {
  return apiRequest<AccountsReceivable>({
    url: '/apps/kuaizhizao/receivables',
    method: 'POST',
    data,
  });
}

export async function updateAccountsReceivable(id: number, data: Partial<AccountsReceivable>): Promise<AccountsReceivable> {
  return apiRequest<AccountsReceivable>({
    url: `/apps/kuaizhizao/receivables/${id}`,
    method: 'PUT',
    data,
  });
}

export async function receivePayment(id: number, paymentMethod: string, paymentDate: string, remarks?: string): Promise<AccountsReceivable> {
  return apiRequest<AccountsReceivable>({
    url: `/apps/kuaizhizao/receivables/${id}/receipt`,
    method: 'POST',
    data: { paymentMethod, paymentDate, remarks },
  });
}

/**
 * 财务统计API
 */
export interface FinanceStats {
  totalPayable: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
  totalReceivable: number;
  receivedAmount: number;
  pendingReceivable: number;
  overdueReceivable: number;
}

export async function getFinanceStats(): Promise<FinanceStats> {
  return apiRequest<FinanceStats>({
    url: '/apps/kuaizhizao/finance-management/stats',
    method: 'GET',
  });
}
