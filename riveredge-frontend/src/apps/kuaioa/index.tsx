/**
 * 轻办公 APP 入口
 */

import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageSkeleton from '../../components/page-skeleton';

const withPageSuspense = (LazyComponent: React.LazyExoticComponent<React.ComponentType<any>>) => (
  <Suspense fallback={<PageSkeleton />}>
    <LazyComponent />
  </Suspense>
);

const WorkbenchPage = lazy(() => import('./pages/workbench/index'));
const FormTemplatesPage = lazy(() => import('./pages/approval/form-templates/index'));
const FormTemplateDesignerPage = lazy(() => import('./pages/approval/form-templates/designer'));
const FormRequestsPage = lazy(() => import('./pages/approval/form-requests/index'));
const MountedFormRequestsPage = lazy(() => import('./pages/forms/mounted/index'));
const SpecialPricePage = lazy(() => import('./pages/collaboration/special-price/index'));
const ConcessionPage = lazy(() => import('./pages/collaboration/concession/index'));
const ProcessDeviationPage = lazy(() => import('./pages/collaboration/process-deviation/index'));
const TrainingPlansPage = lazy(() => import('./pages/hr/training-plans/index'));
const TrainingRecordsPage = lazy(() => import('./pages/hr/training-records/index'));
const WorkLicensesPage = lazy(() => import('./pages/hr/work-licenses/index'));
const DeptTrainingApplicationsPage = lazy(() => import('./pages/hr/dept-training-applications/index'));
const SpecialWorkQualificationsPage = lazy(() => import('./pages/hr/special-work-qualifications/index'));
const TrainingTemplatesPage = lazy(() => import('./pages/hr/training-templates/index'));
const LeavePage = lazy(() => import('./pages/hr/leave/index'));
const EmployeesPage = lazy(() => import('./pages/hr/employees/index'));
const AttendanceListPage = lazy(() => import('./pages/hr/attendance/index'));
const AttendanceFillPage = lazy(() => import('./pages/hr/attendance/fill'));
const AttendanceDayRegisterPage = lazy(() => import('./pages/hr/attendance/day-register'));
const LivingAdvancesPage = lazy(() => import('./pages/hr/living-advances/index'));
const RewardsPage = lazy(() => import('./pages/hr/rewards/index'));
const PayrollSettlementsPage = lazy(() => import('./pages/hr/payroll-settlements/index'));
const PayrollSettlementDetailPage = lazy(() => import('./pages/hr/payroll-settlements/detail'));
const LivingPayoutPage = lazy(() => import('./pages/hr/living-payout/index'));
const WelfareBatchesPage = lazy(() => import('./pages/hr/welfare-batches/index'));
const WelfareBatchDetailPage = lazy(() => import('./pages/hr/welfare-batches/detail'));
const AnnualPayrollStatsPage = lazy(() => import('./pages/hr/annual-payroll-stats/index'));
const PersonalPayrollPage = lazy(() => import('./pages/hr/personal-payroll/index'));
const EmployeeMovementsPage = lazy(() => import('./pages/hr/employee-movements/index'));
const PostSubsidiesPage = lazy(() => import('./pages/hr/post-subsidies/index'));
const MinimumWagePage = lazy(() => import('./pages/hr/minimum-wage/index'));
/** 自快制造迁入人事：页面实现仍在 kuaizhizao/pages/performance，权限码暂用 kuaizhizao:performance-* */
const SkillsPage = lazy(() => import('../kuaizhizao/pages/performance/skills'));
const HourlyRatesPage = lazy(() => import('../kuaizhizao/pages/performance/hourly-rates'));
const KpiDefinitionsPage = lazy(() => import('../kuaizhizao/pages/performance/kpi-definitions'));
const EmployeeConfigsPage = lazy(() => import('../kuaizhizao/pages/performance/employee-configs'));
const PerformanceSummariesPage = lazy(() => import('../kuaizhizao/pages/performance/summaries'));
const EmployeeEfficiencyRankingPage = lazy(
  () => import('../kuaizhizao/pages/performance/reports/EmployeeEfficiencyRanking'),
);
const PieceRateSalarySummaryPage = lazy(
  () => import('../kuaizhizao/pages/performance/reports/PieceRateSalarySummary'),
);
const LicensesPage = lazy(() => import('./pages/compliance/licenses/index'));
const AssetPurchasesPage = lazy(() => import('./pages/assets/purchases/index'));
const AssetsRegistryPage = lazy(() => import('./pages/assets/registry/index'));
const AnnouncementsPage = lazy(() => import('./pages/admin/announcements/index'));
const SealPage = lazy(() => import('./pages/admin/seal/index'));

const KuaioaPageNotFound: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div style={{ padding: 24 }}>
      <h3>{t('app.kuaioa.route.notFoundTitle')}</h3>
      <p>{t('app.kuaioa.route.notFoundHint')}</p>
    </div>
  );
};

const KuaioaApp: React.FC = () => (
  <Routes>
    <Route path="workbench" element={withPageSuspense(WorkbenchPage)} />
    <Route path="approval/form-templates" element={withPageSuspense(FormTemplatesPage)} />
    <Route path="approval/form-templates/designer" element={withPageSuspense(FormTemplateDesignerPage)} />
    <Route path="approval/form-requests" element={withPageSuspense(FormRequestsPage)} />
    <Route path="forms/:templateCode" element={withPageSuspense(MountedFormRequestsPage)} />
    <Route path="collaboration/special-price" element={withPageSuspense(SpecialPricePage)} />
    <Route path="collaboration/concession" element={withPageSuspense(ConcessionPage)} />
    <Route path="collaboration/process-deviation" element={withPageSuspense(ProcessDeviationPage)} />
    <Route path="hr/dept-training-applications" element={withPageSuspense(DeptTrainingApplicationsPage)} />
    <Route path="hr/training-plans" element={withPageSuspense(TrainingPlansPage)} />
    <Route path="hr/training-records" element={withPageSuspense(TrainingRecordsPage)} />
    <Route path="hr/special-work-qualifications" element={withPageSuspense(SpecialWorkQualificationsPage)} />
    <Route path="hr/work-licenses" element={withPageSuspense(WorkLicensesPage)} />
    <Route path="hr/training-templates" element={withPageSuspense(TrainingTemplatesPage)} />
    <Route path="hr/leave" element={withPageSuspense(LeavePage)} />
    <Route path="hr/employees" element={withPageSuspense(EmployeesPage)} />
    <Route path="hr/employee-movements" element={withPageSuspense(EmployeeMovementsPage)} />
    <Route path="hr/attendance" element={withPageSuspense(AttendanceListPage)} />
    <Route path="hr/attendance/day-register" element={withPageSuspense(AttendanceDayRegisterPage)} />
    <Route path="hr/attendance/:id" element={withPageSuspense(AttendanceFillPage)} />
    <Route path="hr/living-advances" element={withPageSuspense(LivingAdvancesPage)} />
    <Route path="hr/rewards" element={withPageSuspense(RewardsPage)} />
    <Route path="hr/payroll-settlements" element={withPageSuspense(PayrollSettlementsPage)} />
    <Route
      path="hr/payroll-settlements/:id"
      element={withPageSuspense(PayrollSettlementDetailPage)}
    />
    <Route path="hr/living-payout" element={withPageSuspense(LivingPayoutPage)} />
    <Route path="hr/welfare-batches" element={withPageSuspense(WelfareBatchesPage)} />
    <Route
      path="hr/welfare-batches/:id"
      element={withPageSuspense(WelfareBatchDetailPage)}
    />
    <Route path="hr/annual-payroll-stats" element={withPageSuspense(AnnualPayrollStatsPage)} />
    <Route path="hr/personal-payroll" element={withPageSuspense(PersonalPayrollPage)} />
    <Route path="hr/post-subsidies" element={withPageSuspense(PostSubsidiesPage)} />
    <Route path="hr/minimum-wage" element={withPageSuspense(MinimumWagePage)} />
    <Route path="hr/skills" element={withPageSuspense(SkillsPage)} />
    <Route path="hr/hourly-rates" element={withPageSuspense(HourlyRatesPage)} />
    <Route path="hr/kpi-definitions" element={withPageSuspense(KpiDefinitionsPage)} />
    <Route path="hr/employee-configs" element={withPageSuspense(EmployeeConfigsPage)} />
    <Route path="hr/performance-summaries" element={withPageSuspense(PerformanceSummariesPage)} />
    <Route
      path="hr/reports/employee-efficiency-ranking"
      element={withPageSuspense(EmployeeEfficiencyRankingPage)}
    />
    <Route
      path="hr/reports/piece-rate-salary-summary"
      element={withPageSuspense(PieceRateSalarySummaryPage)}
    />
    <Route path="compliance/licenses" element={withPageSuspense(LicensesPage)} />
    <Route path="assets/purchases" element={withPageSuspense(AssetPurchasesPage)} />
    <Route path="assets/registry" element={withPageSuspense(AssetsRegistryPage)} />
    <Route path="admin/announcements" element={withPageSuspense(AnnouncementsPage)} />
    <Route path="admin/seal" element={withPageSuspense(SealPage)} />
    <Route path="" element={<Navigate to="workbench" replace />} />
    <Route path="*" element={<KuaioaPageNotFound />} />
  </Routes>
);

export default KuaioaApp;
