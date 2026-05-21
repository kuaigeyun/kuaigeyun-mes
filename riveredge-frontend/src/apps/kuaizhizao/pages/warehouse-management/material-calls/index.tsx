/**
 * 已合并至配料中心，保留路由重定向。
 */
import React from 'react';
import { Navigate } from 'react-router-dom';

const MaterialCallsRedirect: React.FC = () => (
  <Navigate to="/apps/kuaizhizao/warehouse-management/batching-center" replace />
);

export default MaterialCallsRedirect;
