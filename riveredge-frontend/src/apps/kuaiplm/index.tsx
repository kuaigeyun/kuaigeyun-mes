/**
 * 快研发 APP 入口
 *
 * URL: /apps/kuaiplm/{path}
 */

import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PageSkeleton from '../../components/page-skeleton';

const withPageSuspense = (LazyComponent: React.LazyExoticComponent<React.ComponentType<any>>) => (
  <Suspense fallback={<PageSkeleton />}>
    <LazyComponent />
  </Suspense>
);

const DashboardPage = lazy(() => import('./pages/dashboard/index'));
const RdProjectsListPage = lazy(() => import('./pages/rd-projects/index'));
const RdProjectDetailPage = lazy(() => import('./pages/rd-projects/detail'));
const ChangeManagementPage = lazy(() => import('./pages/change-management/index'));
const KnowledgeBasePage = lazy(() => import('./pages/knowledge-base/index'));
const KnowledgeArticleDetailPage = lazy(() => import('./pages/knowledge-base/detail'));
const RequirementsPage = lazy(() => import('./pages/phase2/requirements/index'));
const DesignReviewsPage = lazy(() => import('./pages/phase2/design-reviews/index'));
const FmeaPage = lazy(() => import('./pages/phase2/fmea/index'));

const KuaiplmApp: React.FC = () => (
  <Routes>
    <Route path="dashboard" element={withPageSuspense(DashboardPage)} />
    <Route path="rd-projects" element={withPageSuspense(RdProjectsListPage)} />
    <Route path="rd-projects/detail/:id" element={withPageSuspense(RdProjectDetailPage)} />
    <Route path="change-management" element={withPageSuspense(ChangeManagementPage)} />
    <Route path="knowledge-base" element={withPageSuspense(KnowledgeBasePage)} />
    <Route path="knowledge-base/detail/:id" element={withPageSuspense(KnowledgeArticleDetailPage)} />
    <Route path="phase2/requirements" element={withPageSuspense(RequirementsPage)} />
    <Route path="phase2/design-reviews" element={withPageSuspense(DesignReviewsPage)} />
    <Route path="phase2/fmea" element={withPageSuspense(FmeaPage)} />
    <Route path="" element={<Navigate to="dashboard" replace />} />
  </Routes>
);

export default KuaiplmApp;
