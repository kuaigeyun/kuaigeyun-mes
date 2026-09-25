/**
 * 继电器制造行业插件入口
 */
import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import PageSkeleton from '../../components/page-skeleton';

const LineCapacityPage = lazy(() => import('./pages/line-capacity'));
const ChangeoverPage = lazy(() => import('./pages/changeover'));
const LineOutputPage = lazy(() => import('./pages/line-output'));
const HomePage = lazy(() => import('./pages/home'));

const withPageSuspense = (LazyComponent: React.LazyExoticComponent<React.ComponentType<object>>) => (
  <Suspense fallback={<PageSkeleton />}>
    <LazyComponent />
  </Suspense>
);

export default function IndustryRelayApp() {
  return (
    <Routes>
      <Route index element={withPageSuspense(HomePage)} />
      <Route path="line-capacity" element={withPageSuspense(LineCapacityPage)} />
      <Route path="changeover" element={withPageSuspense(ChangeoverPage)} />
      <Route path="line-output" element={withPageSuspense(LineOutputPage)} />
      <Route path="*" element={<Navigate to="." replace />} />
    </Routes>
  );
}
