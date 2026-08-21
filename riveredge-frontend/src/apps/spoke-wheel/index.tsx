/**
 * 辐条轮毂总装 APP 入口
 */
import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PageSkeleton from '../../components/page-skeleton';

const withPageSuspense = (LazyComponent: React.LazyExoticComponent<React.ComponentType<any>>) => (
  <Suspense fallback={<PageSkeleton />}>
    <LazyComponent />
  </Suspense>
);

const AssemblyDebugPage = lazy(() => import('./pages/assembly-debug/index'));

export default function SpokeWheelApp() {
  return (
    <Routes>
      <Route path="assembly-debug" element={withPageSuspense(AssemblyDebugPage)} />
      <Route path="*" element={<Navigate to="assembly-debug" replace />} />
    </Routes>
  );
}