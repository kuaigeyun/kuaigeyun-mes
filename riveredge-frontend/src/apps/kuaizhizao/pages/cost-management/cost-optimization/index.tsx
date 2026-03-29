/**
 * 兼容旧菜单「成本优化」：重定向至成本核算（快智造核算页尚未与财务端对齐时仅进入台账）。
 */

import React from 'react';
import { Navigate } from 'react-router-dom';

const CostOptimizationRedirect: React.FC = () => <Navigate to="../cost-calculations" replace />;

export default CostOptimizationRedirect;
