/**
 * 快格轻财务 APP 入口文件
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';

// 总账管理页面
import AccountSubjectsPage from './pages/account-subjects';
import VouchersPage from './pages/vouchers';
import PeriodClosingsPage from './pages/period-closings';

// 应收应付页面
import CustomerInvoicesPage from './pages/customer-invoices';
import SupplierInvoicesPage from './pages/supplier-invoices';
import ReceiptsPage from './pages/receipts';
import PaymentsPage from './pages/payments';

// 成本核算页面
import StandardCostsPage from './pages/standard-costs';
import ActualCostsPage from './pages/actual-costs';
import CostCentersPage from './pages/cost-centers';

// 财务报表页面
import FinancialReportsPage from './pages/financial-reports';

const KuaiaccApp: React.FC = () => {
  return (
    <Routes>
      {/* 总账管理 */}
      <Route path="ledger/accounts" element={<AccountSubjectsPage />} />
      <Route path="ledger/vouchers" element={<VouchersPage />} />
      <Route path="ledger/close" element={<PeriodClosingsPage />} />
      
      {/* 应收应付 */}
      <Route path="receivable-payable/customer-invoice" element={<CustomerInvoicesPage />} />
      <Route path="receivable-payable/supplier-invoice" element={<SupplierInvoicesPage />} />
      <Route path="receivable-payable/receipt" element={<ReceiptsPage />} />
      <Route path="receivable-payable/payment" element={<PaymentsPage />} />
      
      {/* 成本核算 */}
      <Route path="cost/standard" element={<StandardCostsPage />} />
      <Route path="cost/actual" element={<ActualCostsPage />} />
      <Route path="cost/center" element={<CostCentersPage />} />
      
      {/* 财务报表 */}
      <Route path="reports/balance-sheet" element={<FinancialReportsPage />} />
      <Route path="reports/profit" element={<FinancialReportsPage />} />
      <Route path="reports/cash-flow" element={<FinancialReportsPage />} />
      <Route path="reports/cost" element={<FinancialReportsPage />} />
      
      {/* 兼容路由（直接访问） */}
      <Route path="account-subjects" element={<AccountSubjectsPage />} />
      <Route path="vouchers" element={<VouchersPage />} />
      <Route path="period-closings" element={<PeriodClosingsPage />} />
      <Route path="customer-invoices" element={<CustomerInvoicesPage />} />
      <Route path="supplier-invoices" element={<SupplierInvoicesPage />} />
      <Route path="receipts" element={<ReceiptsPage />} />
      <Route path="payments" element={<PaymentsPage />} />
      <Route path="standard-costs" element={<StandardCostsPage />} />
      <Route path="actual-costs" element={<ActualCostsPage />} />
      <Route path="cost-centers" element={<CostCentersPage />} />
      <Route path="financial-reports" element={<FinancialReportsPage />} />
      
      {/* 默认路由 */}
      <Route index element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>快格轻财务</div>} />
      <Route path="*" element={<div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>页面未找到</div>} />
    </Routes>
  );
};

export default KuaiaccApp;

