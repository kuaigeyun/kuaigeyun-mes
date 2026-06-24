/**
 * 好力 GO（haoligo）应用入口
 *
 * 设备 / 模具 / 巡查 独立实现，API：`/api/v1/apps/haoligo`。规划见 `riveredge-adapt/haoli-go/PLAN.md`。
 */

import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import PageSkeleton from '../../components/page-skeleton';
import HaoligoAppLayout from './layouts/AppLayout';
import { withHaoligoPermission } from './components/HaoligoPermissionRoute';
import HaoligoDefaultRedirect from './components/HaoligoDefaultRedirect';

const withPageSuspense = (LazyComponent: React.LazyExoticComponent<React.ComponentType>) => (
  <Suspense fallback={<PageSkeleton />}>
    <LazyComponent />
  </Suspense>
);

const WorkspacePage = lazy(() => import('./pages/workspace'));
const EquipmentPage = lazy(() => import('./pages/equipment'));
const EquipmentCategoriesPage = lazy(() => import('./pages/equipment/categories'));
const EquipmentManufacturersPage = lazy(() => import('./pages/equipment/manufacturers'));
const EquipmentLedgerPage = lazy(() => import('./pages/equipment/ledger'));
const EquipmentInspectionParamsPage = lazy(() => import('./pages/equipment/inspection-params'));
const EquipmentInspectionParamSetsPage = lazy(() => import('./pages/equipment/inspection-param-sets'));
const EquipmentUpkeepParamsPage = lazy(() => import('./pages/equipment/upkeep-params'));
const EquipmentUpkeepParamSetsPage = lazy(() => import('./pages/equipment/upkeep-param-sets'));
const EquipmentPatrolRoutesPage = lazy(() => import('./pages/equipment/patrol-routes'));
const EquipmentStatusDashboardPage = lazy(() => import('./pages/equipment/dashboard/status'));
const EquipmentCapacityReportPage = lazy(() => import('./pages/equipment/reports/capacity'));
const EquipmentMaintenancePlanReportPage = lazy(() => import('./pages/equipment/reports/maintenance-plan'));
const EquipmentDocumentsSpotCheckPage = lazy(() => import('./pages/equipment/documents/spot-check'));
const EquipmentDocumentsRoutePatrolPage = lazy(() => import('./pages/equipment/documents/route-patrol'));
const EquipmentDocumentsUpkeepSheetPage = lazy(() => import('./pages/equipment/documents/upkeep-sheet'));
const EquipmentDocumentsUpkeepCompletePage = lazy(() => import('./pages/equipment/documents/upkeep-complete'));
const EquipmentDocumentsOutputRecordPage = lazy(() => import('./pages/equipment/documents/output-record'));
const EquipmentDocumentsStatusAdjustmentPage = lazy(() => import('./pages/equipment/documents/status-adjustment'));
const EquipmentDocumentsAcceptancePage = lazy(() => import('./pages/equipment/documents/acceptance'));
const MoldLedgerPage = lazy(() => import('./pages/molds/ledger'));
const MoldUpkeepParamsPage = lazy(() => import('./pages/molds/upkeep-params'));
const MoldUpkeepParamSetsPage = lazy(() => import('./pages/molds/upkeep-param-sets'));
const MoldWarehousePage = lazy(() => import('./pages/molds/warehouse'));
const MoldBorrowOutPage = lazy(() => import('./pages/molds/documents/borrow-out'));
const MoldReturnInPage = lazy(() => import('./pages/molds/documents/return-in'));
const MoldTrialSheetsPage = lazy(() => import('./pages/molds/documents/trial'));
const MoldUpkeepSheetPage = lazy(() => import('./pages/molds/documents/upkeep'));
const MoldUpkeepCompleteSheetPage = lazy(() => import('./pages/molds/documents/upkeep-complete'));
const MoldRepairSheetPage = lazy(() => import('./pages/molds/documents/repair'));
const MoldRepairCompleteSheetPage = lazy(() => import('./pages/molds/documents/repair-complete'));
const MoldMaintenanceLegacyRedirect = lazy(() => import('./pages/molds/documents/maintenance'));
const MoldMaintenanceCompleteLegacyRedirect = lazy(
  () => import('./pages/molds/documents/maintenance-complete'),
);
const MoldOutsourceMaintenancePage = lazy(() => import('./pages/molds/documents/outsource-maintenance'));
const MoldOutsourceMaintenanceCompletePage = lazy(() => import('./pages/molds/documents/outsource-complete'));
const MoldReportTrialRecordPage = lazy(() => import('./pages/molds/reports/trial-record'));
const MoldReportMaintenanceAlertPage = lazy(() => import('./pages/molds/reports/maintenance-alert'));
const MoldReportMaintenanceLogPage = lazy(() => import('./pages/molds/reports/maintenance-log'));
const MoldReportOutsourceMaintenanceLogPage = lazy(() => import('./pages/molds/reports/outsource-maintenance-log'));
const PatrolIndexPage = lazy(() => import('./pages/patrol'));
const PatrolDailyFormPage = lazy(() => import('./pages/patrol/daily/form'));
const PatrolHazardsPage = lazy(() => import('./pages/patrol/hazards'));
const PatrolReportGroupPage = lazy(() => import('./pages/patrol/reports/PatrolReportGroupPage'));
const PatrolReportLegacyRedirect = lazy(() => import('./pages/patrol/reports/PatrolReportLegacyRedirect'));
const QualityIssuesPage = lazy(() => import('./pages/quality/issues'));
const QualityComplaintsPage = lazy(() => import('./pages/quality/complaints'));
const QualityLineStopsPage = lazy(() => import('./pages/quality/line-stops'));
const QualityIssuesRegisterPage = lazy(() => import('./pages/quality/issues/register'));
const QualityIssuesHandlePage = lazy(() => import('./pages/quality/issues/handle'));
const QualityComplaintsRegisterPage = lazy(() => import('./pages/quality/complaints/register'));
const QualityComplaintsHandlePage = lazy(() => import('./pages/quality/complaints/handle'));
const QualityLineStopsRegisterPage = lazy(() => import('./pages/quality/line-stops/register'));
const QualityLineStopsHandlePage = lazy(() => import('./pages/quality/line-stops/handle'));
const QualityIssueReportPage = lazy(() => import('./pages/quality/reports/issues'));
const QualityComplaintReportPage = lazy(() => import('./pages/quality/reports/complaints'));
const QualityLineStopReportPage = lazy(() => import('./pages/quality/reports/line-stops'));
const HaoligoApp: React.FC = () => (
  <Routes>
    <Route element={<HaoligoAppLayout />}>
      <Route
        path="workspace"
        element={withHaoligoPermission(
          'haoligo:workspace-dashboard:read',
          withPageSuspense(WorkspacePage),
        )}
      />
      <Route path="equipment/workshops" element={<Navigate to="/apps/master-data/factory/workshops" replace />} />
      <Route path="equipment/categories" element={withPageSuspense(EquipmentCategoriesPage)} />
      <Route path="equipment/manufacturers" element={withPageSuspense(EquipmentManufacturersPage)} />
      <Route path="equipment/ledger" element={withPageSuspense(EquipmentLedgerPage)} />
      <Route path="equipment/inspection-params" element={withPageSuspense(EquipmentInspectionParamsPage)} />
      <Route path="equipment/inspection-param-sets" element={withPageSuspense(EquipmentInspectionParamSetsPage)} />
      <Route
        path="equipment/upkeep-params"
        element={withHaoligoPermission('haoligo:equipment-upkeep-params:read', withPageSuspense(EquipmentUpkeepParamsPage))}
      />
      <Route
        path="equipment/upkeep-param-sets"
        element={withHaoligoPermission(
          'haoligo:equipment-upkeep-param-sets:read',
          withPageSuspense(EquipmentUpkeepParamSetsPage),
        )}
      />
      <Route path="equipment/documents/spot-check" element={withPageSuspense(EquipmentDocumentsSpotCheckPage)} />
      <Route path="equipment/documents/route-patrol" element={withPageSuspense(EquipmentDocumentsRoutePatrolPage)} />
      <Route path="equipment/documents/upkeep-sheet" element={withPageSuspense(EquipmentDocumentsUpkeepSheetPage)} />
      <Route path="equipment/documents/upkeep-complete" element={withPageSuspense(EquipmentDocumentsUpkeepCompletePage)} />
      <Route
        path="equipment/documents/maintenance-report"
        element={<Navigate to="/apps/haoligo/equipment/documents/upkeep-sheet" replace />}
      />
      <Route path="equipment/documents/output-record" element={withPageSuspense(EquipmentDocumentsOutputRecordPage)} />
      <Route
        path="equipment/documents/status-adjustment"
        element={withPageSuspense(EquipmentDocumentsStatusAdjustmentPage)}
      />
      <Route
        path="equipment/documents/acceptance"
        element={withPageSuspense(EquipmentDocumentsAcceptancePage)}
      />
      <Route
        path="equipment/settings/output-dataset"
        element={<Navigate to="/apps/haoligo/equipment/documents/output-record" replace />}
      />
      <Route
        path="equipment/reports/point-inspection"
        element={<Navigate to="/apps/haoligo/equipment/documents/spot-check" replace />}
      />
      <Route
        path="equipment/reports/patrol-records"
        element={<Navigate to="/apps/haoligo/equipment/documents/route-patrol" replace />}
      />
      <Route path="equipment/patrol-routes" element={withPageSuspense(EquipmentPatrolRoutesPage)} />
      <Route path="equipment/dashboard/status" element={withPageSuspense(EquipmentStatusDashboardPage)} />
      <Route path="equipment/reports/capacity" element={withPageSuspense(EquipmentCapacityReportPage)} />
      <Route
        path="equipment/reports/maintenance-plan"
        element={withHaoligoPermission(
          'haoligo:equipment-reports-maintenance-plan:read',
          withPageSuspense(EquipmentMaintenancePlanReportPage),
        )}
      />
      <Route path="equipment" element={withPageSuspense(EquipmentPage)} />
      <Route path="molds" element={<Outlet />}>
        <Route index element={<Navigate to="ledger" replace />} />
        <Route
          path="ledger"
          element={withHaoligoPermission('haoligo:molds-ledger:read', withPageSuspense(MoldLedgerPage))}
        />
        <Route
          path="upkeep-params"
          element={withHaoligoPermission('haoligo:molds-upkeep-params:read', withPageSuspense(MoldUpkeepParamsPage))}
        />
        <Route
          path="upkeep-param-sets"
          element={withHaoligoPermission(
            'haoligo:molds-upkeep-param-sets:read',
            withPageSuspense(MoldUpkeepParamSetsPage),
          )}
        />
        <Route
          path="warehouse"
          element={withHaoligoPermission('haoligo:molds-warehouse:read', withPageSuspense(MoldWarehousePage))}
        />
        <Route path="documents/trial" element={withPageSuspense(MoldTrialSheetsPage)} />
        <Route path="documents/borrow-out" element={withPageSuspense(MoldBorrowOutPage)} />
        <Route path="documents/return-in" element={withPageSuspense(MoldReturnInPage)} />
        <Route path="documents/upkeep" element={withPageSuspense(MoldUpkeepSheetPage)} />
        <Route path="documents/upkeep-complete" element={withPageSuspense(MoldUpkeepCompleteSheetPage)} />
        <Route path="documents/repair" element={withPageSuspense(MoldRepairSheetPage)} />
        <Route path="documents/repair-complete" element={withPageSuspense(MoldRepairCompleteSheetPage)} />
        <Route path="documents/maintenance" element={withPageSuspense(MoldMaintenanceLegacyRedirect)} />
        <Route
          path="documents/maintenance-complete"
          element={withPageSuspense(MoldMaintenanceCompleteLegacyRedirect)}
        />
        <Route path="documents/outsource-maintenance" element={withPageSuspense(MoldOutsourceMaintenancePage)} />
        <Route path="documents/outsource-complete" element={withPageSuspense(MoldOutsourceMaintenanceCompletePage)} />
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
          element={<Navigate to="/apps/haoligo/equipment/documents/spot-check" replace />}
        />
        <Route
          path="reports/patrol-records"
          element={<Navigate to="/apps/haoligo/equipment/documents/route-patrol" replace />}
        />
      </Route>
      <Route path="quality" element={<Outlet />}>
        <Route index element={<Navigate to="/apps/haoligo/quality/issues/register" replace />} />
        <Route path="issues" element={withPageSuspense(QualityIssuesPage)} />
        <Route path="issues/register" element={withPageSuspense(QualityIssuesRegisterPage)} />
        <Route path="issues/handle" element={withPageSuspense(QualityIssuesHandlePage)} />
        <Route path="complaints" element={withPageSuspense(QualityComplaintsPage)} />
        <Route path="complaints/register" element={withPageSuspense(QualityComplaintsRegisterPage)} />
        <Route path="complaints/handle" element={withPageSuspense(QualityComplaintsHandlePage)} />
        <Route path="line-stops" element={withPageSuspense(QualityLineStopsPage)} />
        <Route path="line-stops/register" element={withPageSuspense(QualityLineStopsRegisterPage)} />
        <Route path="line-stops/handle" element={withPageSuspense(QualityLineStopsHandlePage)} />
        <Route path="reports/issues" element={withPageSuspense(QualityIssueReportPage)} />
        <Route path="reports/complaints" element={withPageSuspense(QualityComplaintReportPage)} />
        <Route path="reports/line-stops" element={withPageSuspense(QualityLineStopReportPage)} />
      </Route>
      <Route index element={<HaoligoDefaultRedirect />} />
    </Route>
  </Routes>
);

export default HaoligoApp;
