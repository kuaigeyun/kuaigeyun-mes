/**
 * 快视觉应用路由
 */

import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import PageSkeleton from '../../components/page-skeleton';

const DashboardPage = lazy(() => import('./pages/dashboard'));
const InspectionsPage = lazy(() => import('./pages/inspections'));
const AgentsPage = lazy(() => import('./pages/agents'));
const CamerasPage = lazy(() => import('./pages/cameras'));
const RecipesPage = lazy(() => import('./pages/recipes'));
const ReviewsPage = lazy(() => import('./pages/reviews'));
const SamplesPage = lazy(() => import('./pages/samples'));
const ModelsPage = lazy(() => import('./pages/models'));

const withPageSuspense = (LazyComponent: React.LazyExoticComponent<React.ComponentType>) => (
  <Suspense fallback={<PageSkeleton variant="content" />}>
    <LazyComponent />
  </Suspense>
);

const KuaivisionApp: React.FC = () => (
  <Routes>
    <Route path="/" element={<Navigate to="dashboard" replace />} />
    <Route path="dashboard" element={withPageSuspense(DashboardPage)} />
    <Route path="inspections" element={withPageSuspense(InspectionsPage)} />
    <Route path="reviews" element={withPageSuspense(ReviewsPage)} />
    <Route path="cameras" element={withPageSuspense(CamerasPage)} />
    <Route path="recipes" element={withPageSuspense(RecipesPage)} />
    <Route path="samples" element={withPageSuspense(SamplesPage)} />
    <Route path="models" element={withPageSuspense(ModelsPage)} />
    <Route path="agents" element={withPageSuspense(AgentsPage)} />
    <Route path="*" element={<Navigate to="dashboard" replace />} />
  </Routes>
);

export default KuaivisionApp;
