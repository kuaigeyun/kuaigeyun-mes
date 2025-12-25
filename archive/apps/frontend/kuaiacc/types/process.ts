/**
 * 财务数据类型定义
 * 
 * 定义会计科目、凭证、发票、成本等的数据类型
 * 按照中国财务规范设计
 */

// ==================== 会计科目相关 ====================

export interface AccountSubject {
  id: number;
  uuid: string;
  tenantId?: number;
  subjectCode: string;
  subjectName: string;
  subjectType: string;
  parentId?: number;
  level: number;
  isLeaf: boolean;
  direction: string;
  status: string;
  assistAccounting?: Record<string, any>;
  currency?: string;
  quantityUnit?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountSubjectCreate {
  subjectCode: string;
  subjectName: string;
  subjectType: string;
  parentId?: number;
  level?: number;
  isLeaf?: boolean;
  direction?: string;
  status?: string;
  assistAccounting?: Record<string, any>;
  currency?: string;
  quantityUnit?: string;
}

export interface AccountSubjectUpdate {
  subjectName?: string;
  subjectType?: string;
  parentId?: number;
  level?: number;
  isLeaf?: boolean;
  direction?: string;
  status?: string;
  assistAccounting?: Record<string, any>;
  currency?: string;
  quantityUnit?: string;
}

export interface AccountSubjectListParams {
  skip?: number;
  limit?: number;
  subjectType?: string;
  status?: string;
  parentId?: number;
}

// ==================== 凭证相关 ====================

export interface Voucher {
  id: number;
  uuid: string;
  tenantId?: number;
  voucherNo: string;
  voucherDate: string;
  voucherType: string;
  attachmentCount: number;
  summary?: string;
  totalDebit: number;
  totalCredit: number;
  status: string;
  createdBy: number;
  reviewedBy?: number;
  reviewedAt?: string;
  postedBy?: number;
  postedAt?: string;
  isBalanced: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VoucherCreate {
  voucherNo: string;
  voucherDate: string;
  voucherType: string;
  attachmentCount?: number;
  summary?: string;
  totalDebit: number;
  totalCredit: number;
  status?: string;
  createdBy: number;
}

export interface VoucherUpdate {
  voucherDate?: string;
  voucherType?: string;
  attachmentCount?: number;
  summary?: string;
  totalDebit?: number;
  totalCredit?: number;
  status?: string;
}

export interface VoucherListParams {
  skip?: number;
  limit?: number;
  voucherType?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export interface VoucherEntry {
  id: number;
  uuid: string;
  tenantId?: number;
  voucherId: number;
  entryNo: number;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  debitAmount: number;
  creditAmount: number;
  customerId?: number;
  supplierId?: number;
  departmentId?: number;
  projectId?: number;
  employeeId?: number;
  quantity?: number;
  unitPrice?: number;
  summary?: string;
  createdAt: string;
  updatedAt: string;
}

// ==================== 期末结账相关 ====================

export interface PeriodClosing {
  id: number;
  uuid: string;
  tenantId?: number;
  closingNo: string;
  closingType: string;
  closingPeriod: string;
  closingDate: string;
  status: string;
  checkItems?: Record<string, any>;
  checkResult?: Record<string, any>;
  closedBy?: number;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PeriodClosingCreate {
  closingNo: string;
  closingType: string;
  closingPeriod: string;
  closingDate: string;
  status?: string;
}

export interface PeriodClosingListParams {
  skip?: number;
  limit?: number;
  closingType?: string;
  status?: string;
}

// ==================== 客户发票相关 ====================

export interface CustomerInvoice {
  id: number;
  uuid: string;
  tenantId?: number;
  invoiceNo: string;
  invoiceCode?: string;
  invoiceNumber?: string;
  invoiceType: string;
  invoiceDate: string;
  customerId: number;
  salesOrderId?: number;
  taxRate: number;
  amountExcludingTax: number;
  taxAmount: number;
  amountIncludingTax: number;
  status: string;
  voucherId?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerInvoiceCreate {
  invoiceNo: string;
  invoiceCode?: string;
  invoiceNumber?: string;
  invoiceType: string;
  invoiceDate: string;
  customerId: number;
  salesOrderId?: number;
  taxRate: number;
  amountExcludingTax: number;
  taxAmount: number;
  amountIncludingTax: number;
  status?: string;
}

export interface CustomerInvoiceListParams {
  skip?: number;
  limit?: number;
  customerId?: number;
  status?: string;
  startDate?: string;
  endDate?: string;
}

// ==================== 供应商发票相关 ====================

export interface SupplierInvoice {
  id: number;
  uuid: string;
  tenantId?: number;
  invoiceNo: string;
  invoiceCode?: string;
  invoiceNumber?: string;
  invoiceType: string;
  invoiceDate: string;
  supplierId: number;
  purchaseOrderId?: number;
  taxRate: number;
  amountExcludingTax: number;
  taxAmount: number;
  amountIncludingTax: number;
  status: string;
  voucherId?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierInvoiceCreate {
  invoiceNo: string;
  invoiceCode?: string;
  invoiceNumber?: string;
  invoiceType: string;
  invoiceDate: string;
  supplierId: number;
  purchaseOrderId?: number;
  taxRate: number;
  amountExcludingTax: number;
  taxAmount: number;
  amountIncludingTax: number;
  status?: string;
}

export interface SupplierInvoiceListParams {
  skip?: number;
  limit?: number;
  supplierId?: number;
  status?: string;
  startDate?: string;
  endDate?: string;
}

// ==================== 收款相关 ====================

export interface Receipt {
  id: number;
  uuid: string;
  tenantId?: number;
  receiptNo: string;
  receiptDate: string;
  customerId: number;
  receiptType: string;
  paymentMethod: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  status: string;
  voucherId?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReceiptCreate {
  receiptNo: string;
  receiptDate: string;
  customerId: number;
  receiptType: string;
  paymentMethod: string;
  amount: number;
  currency?: string;
  exchangeRate?: number;
  status?: string;
}

export interface ReceiptListParams {
  skip?: number;
  limit?: number;
  customerId?: number;
  status?: string;
  startDate?: string;
  endDate?: string;
}

// ==================== 付款相关 ====================

export interface Payment {
  id: number;
  uuid: string;
  tenantId?: number;
  paymentNo: string;
  paymentDate: string;
  supplierId: number;
  paymentType: string;
  paymentMethod: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  status: string;
  approvalInstanceId?: number;
  approvalStatus?: string;
  voucherId?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentCreate {
  paymentNo: string;
  paymentDate: string;
  supplierId: number;
  paymentType: string;
  paymentMethod: string;
  amount: number;
  currency?: string;
  exchangeRate?: number;
  status?: string;
}

export interface PaymentListParams {
  skip?: number;
  limit?: number;
  supplierId?: number;
  status?: string;
  startDate?: string;
  endDate?: string;
}

// ==================== 标准成本相关 ====================

export interface StandardCost {
  id: number;
  uuid: string;
  tenantId?: number;
  costNo: string;
  materialId: number;
  materialCode: string;
  materialName: string;
  version: string;
  effectiveDate: string;
  expiryDate?: string;
  materialCost: number;
  laborCost: number;
  manufacturingCost: number;
  totalCost: number;
  unit: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface StandardCostCreate {
  costNo: string;
  materialId: number;
  materialCode: string;
  materialName: string;
  version: string;
  effectiveDate: string;
  expiryDate?: string;
  materialCost: number;
  laborCost: number;
  manufacturingCost: number;
  totalCost: number;
  unit: string;
  status?: string;
}

export interface StandardCostListParams {
  skip?: number;
  limit?: number;
  materialId?: number;
  status?: string;
}

// ==================== 实际成本相关 ====================

export interface ActualCost {
  id: number;
  uuid: string;
  tenantId?: number;
  costNo: string;
  materialId: number;
  materialCode: string;
  materialName: string;
  workOrderId?: number;
  costPeriod: string;
  materialCost: number;
  laborCost: number;
  manufacturingCost: number;
  reworkCost: number;
  toolingCost: number;
  totalCost: number;
  unit: string;
  quantity: number;
  unitCost: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActualCostCreate {
  costNo: string;
  materialId: number;
  materialCode: string;
  materialName: string;
  workOrderId?: number;
  costPeriod: string;
  materialCost: number;
  laborCost: number;
  manufacturingCost: number;
  reworkCost: number;
  toolingCost: number;
  totalCost: number;
  unit: string;
  quantity: number;
  unitCost: number;
  status?: string;
}

export interface ActualCostListParams {
  skip?: number;
  limit?: number;
  materialId?: number;
  costPeriod?: string;
  status?: string;
}

// ==================== 成本中心相关 ====================

export interface CostCenter {
  id: number;
  uuid: string;
  tenantId?: number;
  centerCode: string;
  centerName: string;
  centerType: string;
  departmentId?: number;
  parentId?: number;
  level: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CostCenterCreate {
  centerCode: string;
  centerName: string;
  centerType: string;
  departmentId?: number;
  parentId?: number;
  level?: number;
  status?: string;
}

export interface CostCenterListParams {
  skip?: number;
  limit?: number;
  centerType?: string;
  status?: string;
  parentId?: number;
}

// ==================== 财务报表相关 ====================

export interface FinancialReport {
  id: number;
  uuid: string;
  tenantId?: number;
  reportNo: string;
  reportType: string;
  reportPeriod: string;
  reportDate: string;
  year: number;
  month?: number;
  reportData?: Record<string, any>;
  status: string;
  reviewedBy?: number;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialReportCreate {
  reportNo: string;
  reportType: string;
  reportPeriod: string;
  reportDate: string;
  year: number;
  month?: number;
  reportData?: Record<string, any>;
  status?: string;
}

export interface FinancialReportListParams {
  skip?: number;
  limit?: number;
  reportType?: string;
  year?: number;
  status?: string;
}

