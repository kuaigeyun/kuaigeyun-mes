/**
 * 好力 GO 路由级权限守卫（与 manifest / 菜单 permission_code 一致）
 */
import React from 'react';
import { Navigate } from 'react-router-dom';
import { PermissionGuard } from '../../../components/permission';

export interface HaoligoPermissionRouteProps {
  permission: string;
  children: React.ReactNode;
}

export const HaoligoPermissionRoute: React.FC<HaoligoPermissionRouteProps> = ({
  permission,
  children,
}) => (
  <PermissionGuard
    permission={permission}
    fallback={<Navigate to="/apps/haoligo" replace />}
  >
    {children}
  </PermissionGuard>
);

export function withHaoligoPermission(
  permission: string,
  element: React.ReactNode,
): React.ReactNode {
  return <HaoligoPermissionRoute permission={permission}>{element}</HaoligoPermissionRoute>;
}
