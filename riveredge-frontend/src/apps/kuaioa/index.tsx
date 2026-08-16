/**
 * 轻办公 APP 入口
 */

import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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
const LeavePage = lazy(() => import('./pages/hr/leave/index'));
const LicensesPage = lazy(() => import('./pages/compliance/licenses/index'));
const AssetPurchasesPage = lazy(() => import('./pages/assets/purchases/index'));
const AssetsRegistryPage = lazy(() => import('./pages/assets/registry/index'));
const AnnouncementsPage = lazy(() => import('./pages/admin/announcements/index'));
const SealPage = lazy(() => import('./pages/admin/seal/index'));

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
    <Route path="hr/training-plans" element={withPageSuspense(TrainingPlansPage)} />
    <Route path="hr/training-records" element={withPageSuspense(TrainingRecordsPage)} />
    <Route path="hr/work-licenses" element={withPageSuspense(WorkLicensesPage)} />
    <Route path="hr/leave" element={withPageSuspense(LeavePage)} />
    <Route path="compliance/licenses" element={withPageSuspense(LicensesPage)} />
    <Route path="assets/purchases" element={withPageSuspense(AssetPurchasesPage)} />
    <Route path="assets/registry" element={withPageSuspense(AssetsRegistryPage)} />
    <Route path="admin/announcements" element={withPageSuspense(AnnouncementsPage)} />
    <Route path="admin/seal" element={withPageSuspense(SealPage)} />
    <Route path="" element={<Navigate to="workbench" replace />} />
  </Routes>
);

export default KuaioaApp;
