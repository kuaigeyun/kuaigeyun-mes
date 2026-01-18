/**
 * 权限守卫组件
 * 
 * 根据用户权限控制子组件的显示
 * 
 * @author Luigi Lu
 * @date 2026-01-27
 */

import React from 'react';
import { useModel } from '@umijs/max';
import { hasPermission, hasAnyPermission, hasAllPermissions } from '../../utils/permission';

export interface PermissionGuardProps {
  /** 权限代码（单个） */
  permission?: string;
  /** 权限代码列表（任意一个） */
  anyPermission?: string[];
  /** 权限代码列表（全部） */
  allPermissions?: string[];
  /** 资源名称 */
  resource?: string;
  /** 操作名称 */
  action?: string;
  /** 无权限时显示的内容 */
  fallback?: React.ReactNode;
  /** 子组件 */
  children: React.ReactNode;
}

/**
 * 权限守卫组件
 * 
 * 根据用户权限控制子组件的显示。如果用户不具有指定权限，则不显示子组件或显示fallback内容。
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  permission,
  anyPermission,
  allPermissions,
  resource,
  action,
  fallback = null,
  children,
}) => {
  const { initialState } = useModel('@@initialState');
  const user = initialState?.currentUser;

  let hasAccess = false;

  // 检查单个权限
  if (permission) {
    hasAccess = hasPermission(user, permission);
  }
  // 检查任意一个权限
  else if (anyPermission && anyPermission.length > 0) {
    hasAccess = hasAnyPermission(user, anyPermission);
  }
  // 检查所有权限
  else if (allPermissions && allPermissions.length > 0) {
    hasAccess = hasAllPermissions(user, allPermissions);
  }
  // 检查资源和操作
  else if (resource && action) {
    hasAccess = hasPermission(user, `${resource}:${action}`);
  }
  // 如果没有指定任何权限检查，默认显示
  else {
    hasAccess = true;
  }

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default PermissionGuard;
