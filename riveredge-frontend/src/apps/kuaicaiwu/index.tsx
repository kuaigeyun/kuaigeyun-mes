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
import { LinkedDocumentDetailProvider } from '../../components/linked-document-detail';
import { FinanceVoucherDetailProvider } from './components/FinanceVoucherDetailProvider';

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
const SalesInvoicesPage = lazy(() => import('./pages/finance-management/sales-invoices'));
const SalesInvoiceDetailPage = lazy(() => import('./pages/finance-management/sales-invoices/detail'));
const ReceiptsPage = lazy(() => import('./pages/finance-management/receipts'));
const ReceiptRefundsPage = lazy(() => import('./pages/finance-management/receipt-refunds'));
const PaymentsPage = lazy(() => import('./pages/finance-management/payments'));
const PaymentRefundsPage = lazy(() => import('./pages/finance-management/payment-refunds'));

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
const MarginReportPage = lazy(() => import('./pages/management-analysis/margin-report'));
const SettlementPage = lazy(() => import('./pages/finance-management/settlement'));
const PartnerStatementsPage = lazy(() => import('./pages/finance-management/partner-statements'));
const PartnerStatementDetailPage = lazy(() => import('./pages/finance-management/partner-statements/detail'));
const PriceSettlementPage = lazy(() => import('./pages/finance-management/price-settlement'));
const DocumentReconciliationPage = lazy(() => import('./pages/finance-management/document-reconciliation'));
const BankAccountsPage = lazy(() => import('./pages/finance-management/bank-accounts'));
const NotesReceivablePage = lazy(() => import('./pages/finance-management/notes-receivable'));
const NotesPayablePage = lazy(() => import('./pages/finance-management/notes-payable'));
const PrepaymentsPage = lazy(() => import('./pages/finance-management/prepayments'));
const StandardCostsPage = lazy(() => import('./pages/cost-management/standard-costs'));

// 总账管理
const GlChartOfAccountsPage = lazy(() => import('./pages/gl-management/chart-of-accounts'));
const GlSettingsPage = lazy(() => import('./pages/gl-management/settings'));
const GlOpeningBalancesPage = lazy(() => import('./pages/gl-management/opening-balances'));
const GlVouchersPage = lazy(() => import('./pages/gl-management/vouchers'));
const GlBooksPage = lazy(() => import('./pages/gl-management/books'));
const GlFinancialStatementsPage = lazy(() => import('./pages/gl-management/financial-statements'));
const GlPeriodClosePage = lazy(() => import('./pages/gl-management/period-close'));
const GlCashierPage = lazy(() => import('./pages/gl-management/cashier'));

const TaxSettingsPage = lazy(() => import('./pages/tax-management/settings'));
const VatLedgerPage = lazy(() => import('./pages/tax-management/vat-ledger'));
const InputCertificationPage = lazy(() => import('./pages/tax-management/input-certification'));

const KuaicaiwuApp: React.FC = () => {
  return (
    <LinkedDocumentDetailProvider>
      <FinanceVoucherDetailProvider>
      <Routes>
      {/* 财务管理路由 */}
      <Route path="finance-management/dashboard" element={withPageSuspense(FinanceCenterDashboard)} />
      <Route path="finance-management/receivables" element={withPageSuspense(ReceivableListPage)} />
      <Route path="finance-management/receivables/:id" element={withPageSuspense(ReceivableDetailPage)} />
      <Route path="finance-management/payables" element={withPageSuspense(PayableListPage)} />
      <Route path="finance-management/payables/:id" element={withPageSuspense(PayableDetailPage)} />
      <Route path="finance-management/purchase-invoices" element={withPageSuspense(PurchaseInvoiceListPage)} />
      <Route path="finance-management/purchase-invoices/:id" element={withPageSuspense(PurchaseInvoiceDetailPage)} />
      <Route path="finance-management/sales-invoices" element={withPageSuspense(SalesInvoicesPage)} />
      <Route path="finance-management/sales-invoices/:id" element={withPageSuspense(SalesInvoiceDetailPage)} />
      <Route path="finance-management/receipts" element={withPageSuspense(ReceiptsPage)} />
      <Route path="finance-management/receipt-refunds" element={withPageSuspense(ReceiptRefundsPage)} />
      <Route path="finance-management/payments" element={withPageSuspense(PaymentsPage)} />
      <Route path="finance-management/payment-refunds" element={withPageSuspense(PaymentRefundsPage)} />
      <Route path="finance-management/settlement" element={withPageSuspense(SettlementPage)} />
      <Route path="finance-management/partner-statements" element={withPageSuspense(PartnerStatementsPage)} />
      <Route path="finance-management/partner-statements/:id" element={withPageSuspense(PartnerStatementDetailPage)} />
      <Route path="finance-management/price-settlement" element={withPageSuspense(PriceSettlementPage)} />
      <Route
        path="finance-management/aging-analysis"
        element={<Navigate to="/apps/kuaicaiwu/finance-management/dashboard" replace />}
      />
      <Route path="finance-management/document-reconciliation" element={withPageSuspense(DocumentReconciliationPage)} />
      <Route path="finance-management/bank-accounts" element={withPageSuspense(BankAccountsPage)} />
      <Route path="finance-management/notes-receivable" element={withPageSuspense(NotesReceivablePage)} />
      <Route path="finance-management/notes-payable" element={withPageSuspense(NotesPayablePage)} />
      <Route path="finance-management/prepayments" element={withPageSuspense(PrepaymentsPage)} />

      {/* 成本管理路由 */}
      <Route
        path="cost-management/dashboard"
        element={<Navigate to="/apps/kuaicaiwu/finance-management/dashboard" replace />}
      />
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
      <Route
        path="management-dashboard"
        element={<Navigate to="/apps/kuaicaiwu/finance-management/dashboard" replace />}
      />
      <Route path="management-analysis/margin-report" element={withPageSuspense(MarginReportPage)} />

      {/* 总账管理路由 */}
      <Route path="gl-management/chart-of-accounts" element={withPageSuspense(GlChartOfAccountsPage)} />
      <Route path="gl-management/settings" element={withPageSuspense(GlSettingsPage)} />
      <Route path="gl-management/opening-balances" element={withPageSuspense(GlOpeningBalancesPage)} />
      <Route path="gl-management/vouchers" element={withPageSuspense(GlVouchersPage)} />
      <Route path="gl-management/books" element={withPageSuspense(GlBooksPage)} />
      <Route
        path="gl-management/financial-statements/balance-sheet"
        element={withPageSuspense(GlFinancialStatementsPage)}
      />
      <Route
        path="gl-management/financial-statements/income"
        element={withPageSuspense(GlFinancialStatementsPage)}
      />
      <Route
        path="gl-management/financial-statements/cash-flow"
        element={withPageSuspense(GlFinancialStatementsPage)}
      />
      <Route path="gl-management/period-close" element={withPageSuspense(GlPeriodClosePage)} />
      <Route path="gl-management/cashier" element={withPageSuspense(GlCashierPage)} />

      {/* 税务管理 */}
      <Route path="tax-management/settings" element={withPageSuspense(TaxSettingsPage)} />
      <Route path="tax-management/vat-ledger" element={withPageSuspense(VatLedgerPage)} />
      <Route path="tax-management/input-certification" element={withPageSuspense(InputCertificationPage)} />

      {/* 默认路由 */}
      <Route path="" element={
        <div style={{ textAlign: 'center' }}>
          <h2>轻财务</h2>
          <p>业务驱动的管理会计，提供成本、账款、盈利分析等核心功能</p>
        </div>
      } />
      </Routes>
      </FinanceVoucherDetailProvider>
    </LinkedDocumentDetailProvider>
  );
};

export default KuaicaiwuApp;
