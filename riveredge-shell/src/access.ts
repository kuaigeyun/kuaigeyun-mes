/**
 * 权限定义文件
 *
 * 使用自定义权限管理系统定义权限规则
 * 基于 React Context + Router 守卫实现
 */

import { CurrentUser } from '@/types/api';

/**
 * 权限定义
 * 
 * 自定义权限方式：根据用户信息判断权限
 * 
 * @param initialState - 初始状态（包含用户信息，由 getInitialState 提供）
 * @returns 权限对象
 */
export default function access(initialState: { currentUser?: CurrentUser } | undefined) {
  const { currentUser } = initialState ?? {};
  
  return {
    /**
     * 是否已登录
     */
    canAccess: !!currentUser,
    
    /**
     * 是否为超级管理员
     */
    isSuperAdmin: currentUser?.is_superuser === true,
    
    /**
     * 是否为租户管理员
     */
    isTenantAdmin: currentUser?.is_tenant_admin === true,
    
    /**
     * 是否拥有用户管理权限
     */
    canManageUsers: currentUser?.is_superuser === true || currentUser?.is_tenant_admin === true,
    
    /**
     * 是否拥有角色管理权限
     */
    canManageRoles: currentUser?.is_superuser === true || currentUser?.is_tenant_admin === true,
  };
}

