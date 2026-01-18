/**
 * 权限定义文件
 *
 * 使用自定义权限管理系统定义权限规则
 * 基于 React Context + Router 守卫实现
 */

import { CurrentUser } from './types/api';
import { hasPermission, hasAnyPermission, hasAllPermissions } from './utils/permission';

/**
 * 权限定义
 * 
 * 自定义权限方式：根据用户信息判断权限
 * 
 * @param initialState - 初始状态（包含用户信息，由 Zustand 全局状态提供）
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
     * 是否为平台管理
     */
    isSuperAdmin: currentUser?.is_infra_admin === true,
    
    /**
     * 是否为组织管理员
     */
    isTenantAdmin: currentUser?.is_tenant_admin === true,
    
    /**
     * 是否拥有用户管理权限
     */
    canManageUsers: currentUser?.is_infra_admin === true || currentUser?.is_tenant_admin === true,
    
    /**
     * 是否拥有角色管理权限
     */
    canManageRoles: currentUser?.is_infra_admin === true || currentUser?.is_tenant_admin === true,
    
    /**
     * 检查用户是否具有指定权限
     * 
     * @param permissionCode - 权限代码（格式：resource:action）
     * @returns 是否具有权限
     */
    hasPermission: (permissionCode: string) => hasPermission(currentUser, permissionCode),
    
    /**
     * 检查用户是否具有任意一个权限
     * 
     * @param permissionCodes - 权限代码列表
     * @returns 是否具有任意一个权限
     */
    hasAnyPermission: (permissionCodes: string[]) => hasAnyPermission(currentUser, permissionCodes),
    
    /**
     * 检查用户是否具有所有权限
     * 
     * @param permissionCodes - 权限代码列表
     * @returns 是否具有所有权限
     */
    hasAllPermissions: (permissionCodes: string[]) => hasAllPermissions(currentUser, permissionCodes),
  };
}

