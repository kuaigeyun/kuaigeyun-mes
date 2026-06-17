/**
 * KU-AI 应用路由
 */

import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import PageSkeleton from '../../components/page-skeleton';

const KnowledgePage = lazy(() => import('./pages/knowledge'));

const withPageSuspense = (LazyComponent: React.LazyExoticComponent<React.ComponentType>) => (
  <Suspense fallback={<PageSkeleton variant="content" />}>
    <LazyComponent />
  </Suspense>
);

const KuaiaiApp: React.FC = () => (
  <Routes>
    <Route path="/" element={<Navigate to="knowledge" replace />} />
    <Route path="knowledge" element={withPageSuspense(KnowledgePage)} />
    <Route path="*" element={<Navigate to="knowledge" replace />} />
  </Routes>
);

export default KuaiaiApp;
