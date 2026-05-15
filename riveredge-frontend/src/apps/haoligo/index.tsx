/**
 * 好力 GO（haoligo）应用入口
 *
 * 设备 / 模具 / 巡查 独立实现，API：`/api/v1/apps/haoligo`。规划见 `riveredge-adapt/haoli-go/PLAN.md`。
 */

import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import PageSkeleton from '../../components/page-skeleton';
import HaoligoAppLayout from './layouts/AppLayout';

const withPageSuspense = (LazyComponent: React.LazyExoticComponent<React.ComponentType>) => (
  <Suspense fallback={<PageSkeleton />}>
    <LazyComponent />
  </Suspense>
);

const WorkspacePage = lazy(() => import('./pages/workspace'));
const EquipmentPage = lazy(() => import('./pages/equipment'));
const EquipmentManufacturersPage = lazy(() => import('./pages/equipment/manufacturers'));
const EquipmentLedgerPage = lazy(() => import('./pages/equipment/ledger'));
const EquipmentInspectionParamsPage = lazy(() => import('./pages/equipment/inspection-params'));
const EquipmentInspectionParamSetsPage = lazy(() => import('./pages/equipment/inspection-param-sets'));
const EquipmentPatrolRoutesPage = lazy(() => import('./pages/equipment/patrol-routes'));
const EquipmentReportsPointInspectionPage = lazy(() => import('./pages/equipment/reports/point-inspection'));
const EquipmentReportsPatrolRecordsPage = lazy(() => import('./pages/equipment/reports/patrol-records'));
const MoldLedgerPage = lazy(() => import('./pages/molds/ledger'));
const MoldBorrowOutPage = lazy(() => import('./pages/molds/documents/borrow-out'));
const MoldReturnInPage = lazy(() => import('./pages/molds/documents/return-in'));
const MoldTrialSheetsPage = lazy(() => import('./pages/molds/documents/trial'));
const MoldMaintenancePage = lazy(() => import('./pages/molds/documents/maintenance'));
const MoldMaintenanceCompletePage = lazy(() => import('./pages/molds/documents/maintenance-complete'));
const MoldOutsourceMaintenancePage = lazy(() => import('./pages/molds/documents/outsource-maintenance'));
const MoldOutsourceMaintenanceCompletePage = lazy(() => import('./pages/molds/documents/outsource-complete'));
const MoldOutsourcePendingReviewPage = lazy(() => import('./pages/molds/workbench/pending'));
const MoldReportTrialRecordPage = lazy(() => import('./pages/molds/reports/trial-record'));
const MoldReportMaintenanceAlertPage = lazy(() => import('./pages/molds/reports/maintenance-alert'));
const MoldReportMaintenanceLogPage = lazy(() => import('./pages/molds/reports/maintenance-log'));
const MoldReportOutsourceMaintenanceLogPage = lazy(() => import('./pages/molds/reports/outsource-maintenance-log'));
const PatrolIndexPage = lazy(() => import('./pages/patrol'));
const PatrolDailyFormPage = lazy(() => import('./pages/patrol/daily/form'));
const PatrolHazardsPage = lazy(() => import('./pages/patrol/hazards'));
const PatrolReportGroupPage = lazy(() => import('./pages/patrol/reports/PatrolReportGroupPage'));
const PatrolReportLegacyRedirect = lazy(() => import('./pages/patrol/reports/PatrolReportLegacyRedirect'));

const HaoligoApp: React.FC = () => (
  <Routes>
    <Route element={<HaoligoAppLayout />}>
      <Route path="workspace" element={withPageSuspense(WorkspacePage)} />
      {/* 历史菜单路径：已并入设备总览，旧书签重定向 */}
      <Route path="equipment/workshops" element={<Navigate to="/apps/haoligo/equipment" replace />} />
      <Route path="equipment/categories" element={<Navigate to="/apps/haoligo/equipment" replace />} />
      <Route path="equipment/manufacturers" element={withPageSuspense(EquipmentManufacturersPage)} />
      <Route path="equipment/ledger" element={withPageSuspense(EquipmentLedgerPage)} />
      <Route path="equipment/inspection-params" element={withPageSuspense(EquipmentInspectionParamsPage)} />
      <Route path="equipment/inspection-param-sets" element={withPageSuspense(EquipmentInspectionParamSetsPage)} />
      <Route path="equipment/reports/point-inspection" element={withPageSuspense(EquipmentReportsPointInspectionPage)} />
      <Route path="equipment/reports/patrol-records" element={withPageSuspense(EquipmentReportsPatrolRecordsPage)} />
      <Route path="equipment/patrol-routes" element={withPageSuspense(EquipmentPatrolRoutesPage)} />
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
        <Route path="workbench/pending" element={withPageSuspense(MoldOutsourcePendingReviewPage)} />
        <Route path="reports/trial-record" element={withPageSuspense(MoldReportTrialRecordPage)} />
        <Route path="reports/maintenance-alert" element={withPageSuspense(MoldReportMaintenanceAlertPage)} />
        <Route path="reports/maintenance-log" element={withPageSuspense(MoldReportMaintenanceLogPage)} />
        <Route path="reports/outsource-maintenance-log" element={withPageSuspense(MoldReportOutsourceMaintenanceLogPage)} />
        <Route path="reports/status-overview" element={<Navigate to="/apps/haoligo/molds/ledger" replace />} />
      </Route>
      <Route path="patrol" element={<Outlet />}>
        <Route index element={withPageSuspense(PatrolIndexPage)} />
        <Route path="daily/form" element={withPageSuspense(PatrolDailyFormPage)} />
        <Route
          path="daily/dashboard"
          element={<Navigate to="/apps/haoligo/patrol/reports/group/volume" replace />}
        />
        <Route path="hazards" element={withPageSuspense(PatrolHazardsPage)} />
        <Route
          path="reports/summary"
          element={<Navigate to="/apps/haoligo/patrol/reports/group/volume" replace />}
        />
        <Route
          path="reports/group"
          element={<Navigate to="/apps/haoligo/patrol/reports/group/volume" replace />}
        />
        <Route path="reports/group/:groupKey" element={withPageSuspense(PatrolReportGroupPage)} />
        <Route path="reports/:reportKey" element={withPageSuspense(PatrolReportLegacyRedirect)} />
        <Route
          path="management/overview"
          element={<Navigate to="/apps/haoligo/patrol/reports/group/volume" replace />}
        />
        <Route
          path="charts/fault-by-workshop"
          element={<Navigate to="/apps/haoligo/patrol/reports/issue-type-share" replace />}
        />
        <Route
          path="charts/time-trend"
          element={<Navigate to="/apps/haoligo/patrol/reports/monthly-volume" replace />}
        />
        <Route
          path="charts/keyword-cloud"
          element={<Navigate to="/apps/haoligo/patrol/reports/keyword-cloud" replace />}
        />
        <Route
          path="charts/area-feedback"
          element={<Navigate to="/apps/haoligo/patrol/reports/area-volume-trend" replace />}
        />
        <Route
          path="charts/status-distribution"
          element={<Navigate to="/apps/haoligo/patrol/reports/status-distribution" replace />}
        />
        <Route
          path="charts/feedback-time-trend"
          element={<Navigate to="/apps/haoligo/patrol/reports/monthly-overdue-rate" replace />}
        />
        <Route
          path="charts/top-reporters"
          element={<Navigate to="/apps/haoligo/patrol/reports/overdue-ranking" replace />}
        />
        <Route
          path="charts/area-counts"
          element={<Navigate to="/apps/haoligo/patrol/reports/area-volume-trend" replace />}
        />
        <Route
          path="charts/time-vs-headcount"
          element={<Navigate to="/apps/haoligo/patrol/reports/dept-headcount-trend" replace />}
        />
        <Route
          path="settings/chart-bindings"
          element={<Navigate to="/apps/haoligo/patrol/reports/group/volume" replace />}
        />
        <Route
          path="reports/point-inspection"
          element={<Navigate to="/apps/haoligo/equipment/reports/point-inspection" replace />}
        />
        <Route
          path="reports/patrol-records"
          element={<Navigate to="/apps/haoligo/equipment/reports/patrol-records" replace />}
        />
      </Route>
      <Route index element={<Navigate to="workspace" replace />} />
    </Route>
  </Routes>
);

export default HaoligoApp;
