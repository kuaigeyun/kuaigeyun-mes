/**
 * 好力 GO（haoligo）应用入口
 *
 * 设备 / 模具 / 巡查 独立实现，API：`/api/v1/apps/haoligo`。规划见 `riveredge-adapt/haoli-go/PLAN.md`。
 */

import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import PageSkeleton from '../../components/page-skeleton';
import HaoligoAppLayout from './layouts/AppLayout';

const withPageSuspense = (LazyComponent: React.LazyExoticComponent<React.ComponentType<any>>) => (
  <Suspense fallback={<PageSkeleton />}>
    <LazyComponent />
  </Suspense>
);

const WorkspacePage = lazy(() => import('./pages/workspace'));
const EquipmentPage = lazy(() => import('./pages/equipment'));
const MoldLedgerPage = lazy(() => import('./pages/molds/ledger'));
const MoldBorrowOutPage = lazy(() => import('./pages/molds/documents/borrow-out'));
const MoldReturnInPage = lazy(() => import('./pages/molds/documents/return-in'));
const MoldTrialSheetsPage = lazy(() => import('./pages/molds/documents/trial'));
const MoldMaintenancePage = lazy(() => import('./pages/molds/documents/maintenance'));
const MoldMaintenanceCompletePage = lazy(() => import('./pages/molds/documents/maintenance-complete'));
const MoldOutsourceMaintenancePage = lazy(() => import('./pages/molds/documents/outsource-maintenance'));
const MoldOutsourceMaintenanceCompletePage = lazy(() => import('./pages/molds/documents/outsource-complete'));
const PatrolPage = lazy(() => import('./pages/patrol'));

const HaoligoApp: React.FC = () => (
  <Routes>
    <Route element={<HaoligoAppLayout />}>
      <Route path="workspace" element={withPageSuspense(WorkspacePage)} />
      {/* 历史菜单路径：已并入设备总览，旧书签重定向 */}
      <Route path="equipment/workshops" element={<Navigate to="/apps/haoligo/equipment" replace />} />
      <Route path="equipment/categories" element={<Navigate to="/apps/haoligo/equipment" replace />} />
      <Route path="equipment" element={withPageSuspense(EquipmentPage)} />
      <Route path="molds" element={<Outlet />}>
        <Route index element={<Navigate to="ledger" replace />} />
        <Route path="ledger" element={withPageSuspense(MoldLedgerPage)} />
        <Route path="documents/trial" element={withPageSuspense(MoldTrialSheetsPage)} />
        <Route path="documents/borrow-out" element={withPageSuspense(MoldBorrowOutPage)} />
        <Route path="documents/return-in" element={withPageSuspense(MoldReturnInPage)} />
        <Route path="documents/maintenance" element={withPageSuspense(MoldMaintenancePage)} />
        <Route path="documents/maintenance-complete" element={withPageSuspense(MoldMaintenanceCompletePage)} />
        <Route path="documents/outsource-maintenance" element={withPageSuspense(MoldOutsourceMaintenancePage)} />
        <Route path="documents/outsource-complete" element={withPageSuspense(MoldOutsourceMaintenanceCompletePage)} />
      </Route>
      <Route path="patrol" element={withPageSuspense(PatrolPage)} />
      <Route index element={<Navigate to="workspace" replace />} />
    </Route>
  </Routes>
);

export default HaoligoApp;
