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

const FormTemplatesPage = lazy(() => import('./pages/approval/form-templates/index'));
const FormRequestsPage = lazy(() => import('./pages/approval/form-requests/index'));
const TrainingPlansPage = lazy(() => import('./pages/hr/training-plans/index'));
const TrainingRecordsPage = lazy(() => import('./pages/hr/training-records/index'));
const WorkLicensesPage = lazy(() => import('./pages/hr/work-licenses/index'));
const LicensesPage = lazy(() => import('./pages/compliance/licenses/index'));
const AssetPurchasesPage = lazy(() => import('./pages/assets/purchases/index'));
const AssetsRegistryPage = lazy(() => import('./pages/assets/registry/index'));
const ComingSoonPage = lazy(() => import('./pages/shared/ComingSoonPage'));

const KuaioaApp: React.FC = () => (
  <Routes>
    <Route path="approval/form-templates" element={withPageSuspense(FormTemplatesPage)} />
    <Route path="approval/form-requests" element={withPageSuspense(FormRequestsPage)} />
    <Route path="hr/training-plans" element={withPageSuspense(TrainingPlansPage)} />
    <Route path="hr/training-records" element={withPageSuspense(TrainingRecordsPage)} />
    <Route path="hr/work-licenses" element={withPageSuspense(WorkLicensesPage)} />
    <Route path="hr/leave" element={withPageSuspense(ComingSoonPage)} />
    <Route path="compliance/licenses" element={withPageSuspense(LicensesPage)} />
    <Route path="assets/purchases" element={withPageSuspense(AssetPurchasesPage)} />
    <Route path="assets/registry" element={withPageSuspense(AssetsRegistryPage)} />
    <Route path="admin/announcements" element={withPageSuspense(ComingSoonPage)} />
    <Route path="admin/meetings" element={withPageSuspense(ComingSoonPage)} />
    <Route path="admin/seal" element={withPageSuspense(ComingSoonPage)} />
    <Route path="admin/vehicles" element={withPageSuspense(ComingSoonPage)} />
    <Route path="" element={<Navigate to="approval/form-requests" replace />} />
  </Routes>
);

export default KuaioaApp;
