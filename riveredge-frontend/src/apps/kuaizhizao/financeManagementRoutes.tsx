/**
 * 财务管理路由（源归属快制造；轻财务启用时菜单接管同路径）。
 */
import React, { Suspense, lazy } from 'react';
import { Route, Navigate, Outlet } from 'react-router-dom';
import PageSkeleton from '../../components/page-skeleton';
import { FinanceVoucherDetailProvider } from './components/FinanceVoucherDetailProvider';

const withPageSuspense = (LazyComponent: React.LazyExoticComponent<React.ComponentType<any>>) => (
  <Suspense fallback={<PageSkeleton variant="content" />}>
    <LazyComponent />
  </Suspense>
);

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
const FinanceCenterDashboard = lazy(() => import('./pages/finance-management/dashboard'));
const SettlementPage = lazy(() => import('./pages/finance-management/settlement'));
const PartnerStatementsPage = lazy(() => import('./pages/finance-management/partner-statements'));
const PartnerStatementDetailPage = lazy(() => import('./pages/finance-management/partner-statements/detail'));
const PriceSettlementPage = lazy(() => import('./pages/finance-management/price-settlement'));
const DocumentReconciliationPage = lazy(() => import('./pages/finance-management/document-reconciliation'));
const BankAccountsPage = lazy(() => import('./pages/finance-management/bank-accounts'));
const NotesReceivablePage = lazy(() => import('./pages/finance-management/notes-receivable'));
const NotesPayablePage = lazy(() => import('./pages/finance-management/notes-payable'));
const PrepaymentsPage = lazy(() => import('./pages/finance-management/prepayments'));

const FINANCE_DASHBOARD = '/apps/kuaizhizao/finance-management/dashboard';

function FinanceVoucherLayout() {
  return (
    <FinanceVoucherDetailProvider>
      <Outlet />
    </FinanceVoucherDetailProvider>
  );
}

export function FinanceManagementRoutes() {
  return (
    <Route element={<FinanceVoucherLayout />}>
      <Route path="finance-management/dashboard" element={withPageSuspense(FinanceCenterDashboard)} />
      <Route path="finance-management/receivables" element={withPageSuspense(ReceivableListPage)} />
      <Route path="finance-management/receivables/:id" element={withPageSuspense(ReceivableDetailPage)} />
      <Route path="finance-management/payables" element={withPageSuspense(PayableListPage)} />
      <Route path="finance-management/payables/:id" element={withPageSuspense(PayableDetailPage)} />
      <Route path="finance-management/purchase-invoices" element={withPageSuspense(PurchaseInvoiceListPage)} />
      <Route
        path="finance-management/purchase-invoices/:id"
        element={withPageSuspense(PurchaseInvoiceDetailPage)}
      />
      <Route path="finance-management/sales-invoices" element={withPageSuspense(SalesInvoicesPage)} />
      <Route path="finance-management/sales-invoices/:id" element={withPageSuspense(SalesInvoiceDetailPage)} />
      <Route path="finance-management/receipts" element={withPageSuspense(ReceiptsPage)} />
      <Route path="finance-management/receipt-refunds" element={withPageSuspense(ReceiptRefundsPage)} />
      <Route path="finance-management/payments" element={withPageSuspense(PaymentsPage)} />
      <Route path="finance-management/payment-refunds" element={withPageSuspense(PaymentRefundsPage)} />
      <Route path="finance-management/settlement" element={withPageSuspense(SettlementPage)} />
      <Route path="finance-management/partner-statements" element={withPageSuspense(PartnerStatementsPage)} />
      <Route
        path="finance-management/partner-statements/:id"
        element={withPageSuspense(PartnerStatementDetailPage)}
      />
      <Route path="finance-management/price-settlement" element={withPageSuspense(PriceSettlementPage)} />
      <Route
        path="finance-management/aging-analysis"
        element={<Navigate to={FINANCE_DASHBOARD} replace />}
      />
      <Route
        path="finance-management/document-reconciliation"
        element={withPageSuspense(DocumentReconciliationPage)}
      />
      <Route path="finance-management/bank-accounts" element={withPageSuspense(BankAccountsPage)} />
      <Route path="finance-management/notes-receivable" element={withPageSuspense(NotesReceivablePage)} />
      <Route path="finance-management/notes-payable" element={withPageSuspense(NotesPayablePage)} />
      <Route path="finance-management/prepayments" element={withPageSuspense(PrepaymentsPage)} />
    </Route>
  );
}

/** 轻财务侧栏旧 finance-management 链重定向至快制造 */
export function KuaicaiwuFinanceLegacyRedirect() {
  return <Navigate to={FINANCE_DASHBOARD} replace />;
}
