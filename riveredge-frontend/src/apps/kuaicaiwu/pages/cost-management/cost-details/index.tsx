/**
 * 兼容旧菜单「成本明细」：重定向至成本核算 · 成本归集试算
 */

import React from 'react';
import { Navigate } from 'react-router-dom';

const CostDetailsRedirect: React.FC = () => (
  <Navigate to="/apps/kuaicaiwu/cost-management/cost-calculations?cat=trial&sub=production" replace />
);

export default CostDetailsRedirect;
