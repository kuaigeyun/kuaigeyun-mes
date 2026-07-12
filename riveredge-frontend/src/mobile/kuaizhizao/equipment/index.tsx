import React, { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { MobileAuthGuard, MobileAuthLoading } from './MobileAuthGuard';
import { KUAIZHIZAO_MOBILE_EQUIPMENT_BASE } from './paths';

const WorkbenchPage = React.lazy(() => import('./pages/Workbench'));
const ScanPage = React.lazy(() => import('./pages/Scan'));
const HubPage = React.lazy(() => import('./pages/Hub'));
const SpotCheckPage = React.lazy(() => import('./pages/SpotCheckForm'));
const FaultPage = React.lazy(() => import('./pages/FaultForm'));
const StatusPage = React.lazy(() => import('./pages/StatusForm'));

const withMobileSuspense = (node: React.ReactNode) => (
  <Suspense fallback={<MobileAuthLoading />}>{node}</Suspense>
);

/** 快制造设备企微 H5 路由树 */
const KuaizhizaoMobileEquipmentRoutes: React.FC = () => (
  <MobileAuthGuard>
    <Routes>
      <Route index element={withMobileSuspense(<WorkbenchPage />)} />
      <Route path="scan" element={withMobileSuspense(<ScanPage />)} />
      <Route path=":uuid" element={withMobileSuspense(<HubPage />)} />
      <Route path=":uuid/spot-check" element={withMobileSuspense(<SpotCheckPage />)} />
      <Route path=":uuid/fault" element={withMobileSuspense(<FaultPage />)} />
      <Route path=":uuid/status" element={withMobileSuspense(<StatusPage />)} />
      <Route path="*" element={<Navigate to={KUAIZHIZAO_MOBILE_EQUIPMENT_BASE} replace />} />
    </Routes>
  </MobileAuthGuard>
);

export default KuaizhizaoMobileEquipmentRoutes;
