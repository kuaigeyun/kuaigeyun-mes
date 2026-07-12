/**
 * 移动端 H5 路由（企微自建应用微页面）
 */

import React, { Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import PageSkeleton from '../components/page-skeleton';

const KuaizhizaoMobileEquipmentRoutes = React.lazy(
  () => import('../mobile/kuaizhizao/equipment'),
);

const MobileRoutes: React.FC = () => (
  <Routes>
    <Route
      path="kuaizhizao/equipment/*"
      element={
        <Suspense fallback={<PageSkeleton variant="content" />}>
          <KuaizhizaoMobileEquipmentRoutes />
        </Suspense>
      }
    />
  </Routes>
);

export default MobileRoutes;
