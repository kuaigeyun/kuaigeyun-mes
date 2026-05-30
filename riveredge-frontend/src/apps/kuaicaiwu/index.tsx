/**
 * 轻管理会计 APP 入口文件
 *
 * 路由约定：
 * - 文件: pages/{path}/index.tsx
 * - Route path: {path}
 * - 完整 URL: /apps/kuaicaiwu/{path}
 */

import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PageSkeleton from '../../components/page-skeleton';

const withPageSuspense = (LazyComponent: React.LazyExoticComponent<React.ComponentType<any>>) => (
  <Suspense fallback={<PageSkeleton />}><LazyComponent /></Suspense>
);

// 财务管理页面
const ReceivableListPage = lazy(() => import('./pages/finance-management/receivables'));
const ReceivableDetailPage = lazy(() => import('./pages/finance-management/receivables/detail'));
const PayableListPage = lazy(() => import('./pages/finance-management/payables'));
const PayableDetailPage = lazy(() => import('./pages/finance-management/payables/detail'));
const PurchaseInvoiceListPage = lazy(() => import('./pages/finance-management/purchase-invoices'));
const PurchaseInvoiceDetailPage = lazy(() => import('./pages/finance-management/purchase-invoices/detail'));
const InvoiceListPage = lazy(() => import('./pages/finance-management/invoices'));
const InvoiceDetailPage = lazy(() => import('./pages/finance-management/invoices/detail'));
const SalesInvoicesPage = lazy(() => import('./pages/finance-management/sales-invoices'));
const SalesInvoiceDetailPage = lazy(() => import('./pages/finance-management/sales-invoices/detail'));
const ReceiptsPage = lazy(() => import('./pages/finance-management/receipts'));
const PaymentsPage = lazy(() => import('./pages/finance-management/payments'));

// 成本管理页面
const CostRulesPage = lazy(() => import('./pages/cost-management/cost-rules'));
const CostCalculationsPage = lazy(() => import('./pages/cost-management/cost-calculations'));
const CostDetailsPage = lazy(() => import('./pages/cost-management/cost-details'));
const CostComparisonPage = lazy(() => import('./pages/cost-management/cost-comparison'));
const CostOptimizationPage = lazy(() => import('./pages/cost-management/cost-optimization'));
const CostReportPage = lazy(() => import('./pages/cost-management/cost-report'));
const MonthlySettlementPage = lazy(() => import('./pages/cost-management/monthly-settlement'));

// 管理报表
const FinanceCenterDashboard = lazy(() => import('./pages/finance-management/dashboard'));
const ManagementDashboard = lazy(() => import('./pages/management-dashboard'));
const MarginReportPage = lazy(() => import('./pages/management-analysis/margin-report'));
const SettlementPage = lazy(() => import('./pages/finance-management/settlement'));
const PartnerStatementsPage = lazy(() => import('./pages/finance-management/partner-statements'));
const PartnerStatementDetailPage = lazy(() => import('./pages/finance-management/partner-statements/detail'));
const DocumentReconciliationPage = lazy(() => import('./pages/finance-management/document-reconciliation'));
const BankAccountsPage = lazy(() => import('./pages/finance-management/bank-accounts'));
const PrepaymentsPage = lazy(() => import('./pages/finance-management/prepayments'));
const StandardCostsPage = lazy(() => import('./pages/cost-management/standard-costs'));

const KuaicaiwuApp: React.FC = () => {
  return (
    <Routes>
      {/* 财务管理路由 */}
      <Route path="finance-management/dashboard" element={withPageSuspense(FinanceCenterDashboard)} />
      <Route path="finance-management/receivables" element={withPageSuspense(ReceivableListPage)} />
      <Route path="finance-management/receivables/:id" element={withPageSuspense(ReceivableDetailPage)} />
      <Route path="finance-management/payables" element={withPageSuspense(PayableListPage)} />
      <Route path="finance-management/payables/:id" element={withPageSuspense(PayableDetailPage)} />
      <Route path="finance-management/purchase-invoices" element={withPageSuspense(PurchaseInvoiceListPage)} />
      <Route path="finance-management/purchase-invoices/:id" element={withPageSuspense(PurchaseInvoiceDetailPage)} />
      <Route path="finance-management/invoices" element={withPageSuspense(InvoiceListPage)} />
      <Route path="finance-management/invoices/:code" element={withPageSuspense(InvoiceDetailPage)} />
      <Route path="finance-management/sales-invoices" element={withPageSuspense(SalesInvoicesPage)} />
      <Route path="finance-management/sales-invoices/:id" element={withPageSuspense(SalesInvoiceDetailPage)} />
      <Route path="finance-management/receipts" element={withPageSuspense(ReceiptsPage)} />
      <Route path="finance-management/payments" element={withPageSuspense(PaymentsPage)} />
      <Route path="finance-management/settlement" element={withPageSuspense(SettlementPage)} />
      <Route path="finance-management/partner-statements" element={withPageSuspense(PartnerStatementsPage)} />
      <Route path="finance-management/partner-statements/:id" element={withPageSuspense(PartnerStatementDetailPage)} />
      <Route
        path="finance-management/aging-analysis"
        element={<Navigate to="/apps/kuaicaiwu/finance-management/dashboard" replace />}
      />
      <Route path="finance-management/document-reconciliation" element={withPageSuspense(DocumentReconciliationPage)} />
      <Route path="finance-management/bank-accounts" element={withPageSuspense(BankAccountsPage)} />
      <Route path="finance-management/prepayments" element={withPageSuspense(PrepaymentsPage)} />

      {/* 成本管理路由 */}
      <Route path="cost-management/cost-rules" element={withPageSuspense(CostRulesPage)} />
      <Route path="cost-management/cost-calculations" element={withPageSuspense(CostCalculationsPage)} />
      <Route path="cost-management/cost-details" element={withPageSuspense(CostDetailsPage)} />
      <Route path="cost-management/cost-comparison" element={withPageSuspense(CostComparisonPage)} />
      <Route path="cost-management/cost-optimization" element={withPageSuspense(CostOptimizationPage)} />
      <Route path="cost-management/cost-report" element={withPageSuspense(CostReportPage)} />
      <Route
        path="cost-management/production-cost"
        element={<Navigate to="/apps/kuaicaiwu/cost-management/cost-calculations?cat=trial&sub=production" replace />}
      />
      <Route
        path="cost-management/outsource-cost"
        element={<Navigate to="/apps/kuaicaiwu/cost-management/cost-calculations?tab=outsource" replace />}
      />
      <Route
        path="cost-management/purchase-cost"
        element={<Navigate to="/apps/kuaicaiwu/cost-management/cost-calculations?cat=trial&sub=purchase" replace />}
      />
      <Route
        path="cost-management/quality-cost"
        element={<Navigate to="/apps/kuaicaiwu/cost-management/cost-calculations?cat=trial&sub=quality" replace />}
      />
      <Route path="cost-management/monthly-settlement" element={withPageSuspense(MonthlySettlementPage)} />
      <Route path="cost-management/standard-costs" element={withPageSuspense(StandardCostsPage)} />
      <Route path="management-dashboard" element={withPageSuspense(ManagementDashboard)} />
      <Route path="management-analysis/margin-report" element={withPageSuspense(MarginReportPage)} />

      {/* 默认路由 */}
      <Route path="" element={
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <h2>快财务</h2>
          <p>业务驱动的管理会计，提供成本、账款、盈利分析等核心功能</p>
        </div>
      } />
    </Routes>
  );
};

export default KuaicaiwuApp;
