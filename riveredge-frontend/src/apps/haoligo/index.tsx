/**
 * 好力 GO（haoligo）应用入口
 *
 * 设备 / 模具 / 巡查 独立实现，API：`/api/v1/apps/haoligo`。规划见 `riveredge-adapt/haoli-go/PLAN.md`。
 */

import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PageSkeleton from '../../components/page-skeleton';
import HaoligoAppLayout from './layouts/AppLayout';

const withPageSuspense = (LazyComponent: React.LazyExoticComponent<React.ComponentType<any>>) => (
  <Suspense fallback={<PageSkeleton />}>
    <LazyComponent />
  </Suspense>
);

const EquipmentPage = lazy(() => import('./pages/equipment'));
const MoldsPage = lazy(() => import('./pages/molds'));
const PatrolPage = lazy(() => import('./pages/patrol'));

const HaoligoApp: React.FC = () => (
  <Routes>
    <Route element={<HaoligoAppLayout />}>
      <Route path="equipment" element={withPageSuspense(EquipmentPage)} />
      <Route path="molds" element={withPageSuspense(MoldsPage)} />
      <Route path="patrol" element={withPageSuspense(PatrolPage)} />
      <Route index element={<Navigate to="equipment" replace />} />
    </Route>
  </Routes>
);

export default HaoligoApp;
