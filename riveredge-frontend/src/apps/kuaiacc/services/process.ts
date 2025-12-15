/**
 * 财务数据 API 服务
 * 
 * 提供会计科目、凭证、发票、成本等的 API 调用方法
 * 按照中国财务规范设计
 */

import { api } from '@/services/api';
import type {
  AccountSubject,
  AccountSubjectCreate,
  AccountSubjectUpdate,
  AccountSubjectListParams,
  Voucher,
  VoucherCreate,
  VoucherUpdate,
  VoucherListParams,
  PeriodClosing,
  PeriodClosingCreate,
  PeriodClosingListParams,
  CustomerInvoice,
  CustomerInvoiceCreate,
  CustomerInvoiceListParams,
  SupplierInvoice,
  SupplierInvoiceCreate,
  SupplierInvoiceListParams,
  Receipt,
  ReceiptCreate,
  ReceiptListParams,
  Payment,
  PaymentCreate,
  PaymentListParams,
  StandardCost,
  StandardCostCreate,
  StandardCostListParams,
  ActualCost,
  ActualCostCreate,
  ActualCostListParams,
  CostCenter,
  CostCenterCreate,
  CostCenterListParams,
  FinancialReport,
  FinancialReportCreate,
  FinancialReportListParams,
} from '../types/process';

/**
 * 会计科目 API 服务
 */
export const accountSubjectApi = {
  create: async (data: AccountSubjectCreate): Promise<AccountSubject> => {
    return api.post('/kuaiacc/account-subjects', data);
  },
  list: async (params?: AccountSubjectListParams): Promise<AccountSubject[]> => {
    return api.get('/kuaiacc/account-subjects', { params });
  },
  get: async (uuid: string): Promise<AccountSubject> => {
    return api.get(`/kuaiacc/account-subjects/${uuid}`);
  },
  update: async (uuid: string, data: AccountSubjectUpdate): Promise<AccountSubject> => {
    return api.put(`/kuaiacc/account-subjects/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiacc/account-subjects/${uuid}`);
  },
};

/**
 * 凭证 API 服务
 */
export const voucherApi = {
  create: async (data: VoucherCreate): Promise<Voucher> => {
    return api.post('/kuaiacc/vouchers', data);
  },
  list: async (params?: VoucherListParams): Promise<Voucher[]> => {
    return api.get('/kuaiacc/vouchers', { params });
  },
  get: async (uuid: string): Promise<Voucher> => {
    return api.get(`/kuaiacc/vouchers/${uuid}`);
  },
  update: async (uuid: string, data: VoucherUpdate): Promise<Voucher> => {
    return api.put(`/kuaiacc/vouchers/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiacc/vouchers/${uuid}`);
  },
  review: async (uuid: string): Promise<Voucher> => {
    return api.post(`/kuaiacc/vouchers/${uuid}/review`);
  },
  post: async (uuid: string): Promise<Voucher> => {
    return api.post(`/kuaiacc/vouchers/${uuid}/post`);
  },
};

/**
 * 期末结账 API 服务
 */
export const periodClosingApi = {
  create: async (data: PeriodClosingCreate): Promise<PeriodClosing> => {
    return api.post('/kuaiacc/period-closings', data);
  },
  list: async (params?: PeriodClosingListParams): Promise<PeriodClosing[]> => {
    return api.get('/kuaiacc/period-closings', { params });
  },
  get: async (uuid: string): Promise<PeriodClosing> => {
    return api.get(`/kuaiacc/period-closings/${uuid}`);
  },
  check: async (closingPeriod: string): Promise<any> => {
    return api.post(`/kuaiacc/period-closings/${closingPeriod}/check`);
  },
  execute: async (uuid: string): Promise<PeriodClosing> => {
    return api.post(`/kuaiacc/period-closings/${uuid}/execute`);
  },
};

/**
 * 客户发票 API 服务
 */
export const customerInvoiceApi = {
  create: async (data: CustomerInvoiceCreate): Promise<CustomerInvoice> => {
    return api.post('/kuaiacc/customer-invoices', data);
  },
  list: async (params?: CustomerInvoiceListParams): Promise<CustomerInvoice[]> => {
    return api.get('/kuaiacc/customer-invoices', { params });
  },
  get: async (uuid: string): Promise<CustomerInvoice> => {
    return api.get(`/kuaiacc/customer-invoices/${uuid}`);
  },
  update: async (uuid: string, data: Partial<CustomerInvoiceCreate>): Promise<CustomerInvoice> => {
    return api.put(`/kuaiacc/customer-invoices/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiacc/customer-invoices/${uuid}`);
  },
};

/**
 * 供应商发票 API 服务
 */
export const supplierInvoiceApi = {
  create: async (data: SupplierInvoiceCreate): Promise<SupplierInvoice> => {
    return api.post('/kuaiacc/supplier-invoices', data);
  },
  list: async (params?: SupplierInvoiceListParams): Promise<SupplierInvoice[]> => {
    return api.get('/kuaiacc/supplier-invoices', { params });
  },
  get: async (uuid: string): Promise<SupplierInvoice> => {
    return api.get(`/kuaiacc/supplier-invoices/${uuid}`);
  },
  update: async (uuid: string, data: Partial<SupplierInvoiceCreate>): Promise<SupplierInvoice> => {
    return api.put(`/kuaiacc/supplier-invoices/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiacc/supplier-invoices/${uuid}`);
  },
};

/**
 * 收款 API 服务
 */
export const receiptApi = {
  create: async (data: ReceiptCreate): Promise<Receipt> => {
    return api.post('/kuaiacc/receipts', data);
  },
  list: async (params?: ReceiptListParams): Promise<Receipt[]> => {
    return api.get('/kuaiacc/receipts', { params });
  },
  get: async (uuid: string): Promise<Receipt> => {
    return api.get(`/kuaiacc/receipts/${uuid}`);
  },
  update: async (uuid: string, data: Partial<ReceiptCreate>): Promise<Receipt> => {
    return api.put(`/kuaiacc/receipts/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiacc/receipts/${uuid}`);
  },
};

/**
 * 付款 API 服务
 */
export const paymentApi = {
  create: async (data: PaymentCreate): Promise<Payment> => {
    return api.post('/kuaiacc/payments', data);
  },
  list: async (params?: PaymentListParams): Promise<Payment[]> => {
    return api.get('/kuaiacc/payments', { params });
  },
  get: async (uuid: string): Promise<Payment> => {
    return api.get(`/kuaiacc/payments/${uuid}`);
  },
  update: async (uuid: string, data: Partial<PaymentCreate>): Promise<Payment> => {
    return api.put(`/kuaiacc/payments/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiacc/payments/${uuid}`);
  },
};

/**
 * 标准成本 API 服务
 */
export const standardCostApi = {
  create: async (data: StandardCostCreate): Promise<StandardCost> => {
    return api.post('/kuaiacc/standard-costs', data);
  },
  list: async (params?: StandardCostListParams): Promise<StandardCost[]> => {
    return api.get('/kuaiacc/standard-costs', { params });
  },
  get: async (uuid: string): Promise<StandardCost> => {
    return api.get(`/kuaiacc/standard-costs/${uuid}`);
  },
  update: async (uuid: string, data: Partial<StandardCostCreate>): Promise<StandardCost> => {
    return api.put(`/kuaiacc/standard-costs/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiacc/standard-costs/${uuid}`);
  },
};

/**
 * 实际成本 API 服务
 */
export const actualCostApi = {
  create: async (data: ActualCostCreate): Promise<ActualCost> => {
    return api.post('/kuaiacc/actual-costs', data);
  },
  list: async (params?: ActualCostListParams): Promise<ActualCost[]> => {
    return api.get('/kuaiacc/actual-costs', { params });
  },
  get: async (uuid: string): Promise<ActualCost> => {
    return api.get(`/kuaiacc/actual-costs/${uuid}`);
  },
  update: async (uuid: string, data: Partial<ActualCostCreate>): Promise<ActualCost> => {
    return api.put(`/kuaiacc/actual-costs/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiacc/actual-costs/${uuid}`);
  },
};

/**
 * 成本中心 API 服务
 */
export const costCenterApi = {
  create: async (data: CostCenterCreate): Promise<CostCenter> => {
    return api.post('/kuaiacc/cost-centers', data);
  },
  list: async (params?: CostCenterListParams): Promise<CostCenter[]> => {
    return api.get('/kuaiacc/cost-centers', { params });
  },
  get: async (uuid: string): Promise<CostCenter> => {
    return api.get(`/kuaiacc/cost-centers/${uuid}`);
  },
  update: async (uuid: string, data: Partial<CostCenterCreate>): Promise<CostCenter> => {
    return api.put(`/kuaiacc/cost-centers/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiacc/cost-centers/${uuid}`);
  },
};

/**
 * 财务报表 API 服务
 */
export const financialReportApi = {
  create: async (data: FinancialReportCreate): Promise<FinancialReport> => {
    return api.post('/kuaiacc/financial-reports', data);
  },
  list: async (params?: FinancialReportListParams): Promise<FinancialReport[]> => {
    return api.get('/kuaiacc/financial-reports', { params });
  },
  get: async (uuid: string): Promise<FinancialReport> => {
    return api.get(`/kuaiacc/financial-reports/${uuid}`);
  },
  update: async (uuid: string, data: Partial<FinancialReportCreate>): Promise<FinancialReport> => {
    return api.put(`/kuaiacc/financial-reports/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiacc/financial-reports/${uuid}`);
  },
  generate: async (reportType: string, reportPeriod: string): Promise<FinancialReport> => {
    return api.post('/kuaiacc/financial-reports/generate', null, {
      params: { reportType, reportPeriod },
    });
  },
};

