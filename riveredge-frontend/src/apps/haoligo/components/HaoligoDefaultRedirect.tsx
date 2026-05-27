/**
 * 好力 GO 应用根路径：按用户已授权页面跳转，避免无工作台权限时仍进入 workspace。
 */
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useGlobalStore } from '../../../stores/globalStore';
import { hasPermission } from '../../../utils/permission';

const REDIRECT_CANDIDATES: { permission: string; path: string }[] = [
  { permission: 'haoligo:workspace-dashboard:read', path: '/apps/haoligo/workspace' },
  { permission: 'haoligo:molds-documents-trial:read', path: '/apps/haoligo/molds/documents/trial' },
  {
    permission: 'haoligo:molds-documents-outsource-maintenance:read',
    path: '/apps/haoligo/molds/documents/outsource-maintenance',
  },
  {
    permission: 'haoligo:molds-documents-outsource-complete:read',
    path: '/apps/haoligo/molds/documents/outsource-complete',
  },
  { permission: 'haoligo:molds-ledger:read', path: '/apps/haoligo/molds/ledger' },
  { permission: 'haoligo:equipment-ledger:read', path: '/apps/haoligo/equipment/ledger' },
  { permission: 'haoligo:patrol-hazards:read', path: '/apps/haoligo/patrol/hazards' },
];

const HaoligoDefaultRedirect: React.FC = () => {
  const currentUser = useGlobalStore((s) => s.currentUser);
  for (const { permission, path } of REDIRECT_CANDIDATES) {
    if (hasPermission(currentUser, permission)) {
      return <Navigate to={path} replace />;
    }
  }
  if (hasPermission(currentUser, 'haoligo:entry:read')) {
    return <Navigate to="/apps/haoligo/molds/documents/trial" replace />;
  }
  return <Navigate to="/" replace />;
};

export default HaoligoDefaultRedirect;
