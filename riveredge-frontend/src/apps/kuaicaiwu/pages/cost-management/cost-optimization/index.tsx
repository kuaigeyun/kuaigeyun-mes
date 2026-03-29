/**
 * 兼容旧菜单「成本优化」：重定向至成本核算 · 优化建议
 */

import React from 'react';
import { Navigate } from 'react-router-dom';

const CostOptimizationRedirect: React.FC = () => (
  <Navigate to="/apps/kuaicaiwu/cost-management/cost-calculations?cat=optimization" replace />
);

export default CostOptimizationRedirect;
