/**
 * 好力 GO 应用根路径：按用户已授权页面跳转，避免无工作台权限时仍进入 workspace。
 */
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useGlobalStore } from '../../../stores/globalStore';
import { hasModulePermission } from '../../../utils/permissionContract';

const REDIRECT_CANDIDATES: { module: string; path: string }[] = [
  { module: 'haoligo:workspace-dashboard', path: '/apps/haoligo/workspace' },
  { module: 'haoligo:molds-documents-trial', path: '/apps/haoligo/molds/documents/trial' },
  {
    module: 'haoligo:molds-documents-outsource-maintenance',
    path: '/apps/haoligo/molds/documents/outsource-maintenance',
  },
  {
    module: 'haoligo:molds-documents-outsource-complete',
    path: '/apps/haoligo/molds/documents/outsource-complete',
  },
  { module: 'haoligo:molds-ledger', path: '/apps/haoligo/molds/ledger' },
  { module: 'haoligo:equipment-ledger', path: '/apps/haoligo/equipment/ledger' },
  { module: 'haoligo:patrol-hazards', path: '/apps/haoligo/patrol/hazards' },
];

const HaoligoDefaultRedirect: React.FC = () => {
  const currentUser = useGlobalStore((s) => s.currentUser);
  for (const { module, path } of REDIRECT_CANDIDATES) {
    if (hasModulePermission(currentUser, module, 'read')) {
      return <Navigate to={path} replace />;
    }
  }
  if (hasModulePermission(currentUser, 'haoligo:entry', 'read')) {
    return <Navigate to="/apps/haoligo/molds/documents/trial" replace />;
  }
  return <Navigate to="/" replace />;
};

export default HaoligoDefaultRedirect;
