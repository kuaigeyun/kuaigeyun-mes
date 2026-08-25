/**
 * 行业包容器 APP（侧栏统一入口，业务页由各行业模块提供）
 */
import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Result } from 'antd';
import PageSkeleton from '../../components/page-skeleton';

const IndustryPackHomePage = lazy(() => import('./pages/home'));

const withPageSuspense = (LazyComponent: React.LazyExoticComponent<React.ComponentType<object>>) => (
  <Suspense fallback={<PageSkeleton />}>
    <LazyComponent />
  </Suspense>
);

export default function IndustryPackApp() {
  return (
    <Routes>
      <Route index element={withPageSuspense(IndustryPackHomePage)} />
      <Route path="*" element={<Navigate to="." replace />} />
    </Routes>
  );
}
