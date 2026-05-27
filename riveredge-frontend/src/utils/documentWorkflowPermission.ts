import type { CurrentUser } from '../types/api';
import { hasAnyPermission, hasPermission } from './permission';
import { buildPermissionCode } from './permissionResource';

/**
 * 从来源单据发起「完修」：拥有来源 :complete 或目标 :create 之一即可。
 */
export function permissionCodesForCompleteCreate(
  sourceResource: string,
  targetResource: string,
): string[] {
  return [
    buildPermissionCode(targetResource, 'create'),
    buildPermissionCode(sourceResource, 'complete'),
  ];
}

export function canInitiateCompleteCreate(
  user: CurrentUser | undefined,
  sourceResource: string,
  targetResource: string,
): boolean {
  return hasAnyPermission(user, permissionCodesForCompleteCreate(sourceResource, targetResource));
}

/** 仅来源单据「完修」权限（外协厂商常见配置） */
export function canCompleteSourceDocument(
  user: CurrentUser | undefined,
  sourceResource: string,
): boolean {
  return hasPermission(user, buildPermissionCode(sourceResource, 'complete'));
}
