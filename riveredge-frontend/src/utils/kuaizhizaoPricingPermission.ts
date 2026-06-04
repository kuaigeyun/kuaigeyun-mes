/**
 * 快制造应用内「价格/金额是否可见」历史权限点（kuaizhizao:pricing:view）。
 * 当角色「字段权限」已配置某资源某字段时，AmountDisplay 以字段策略为准；无字段策略时才回退本权限。
 */

import type { CurrentUser } from '../types/api';
import { hasAnyPermission } from './permission';

/** 与 manifest / core_permissions 中 code 一致 */
export const KUAIZHIZAO_PRICING_VIEW = 'kuaizhizao:pricing:view';

/** AmountDisplay 等使用的权限码列表（任一命中即可见） */
export function kuaizhizaoPricingViewPermissionCodes(resource?: string): string[] {
  const codes = [KUAIZHIZAO_PRICING_VIEW];
  if (resource?.trim()) {
    codes.push(`${resource.trim()}:view:amount`);
  }
  return codes;
}

export function canViewKuaizhizaoPricing(user: CurrentUser | undefined, resource?: string): boolean {
  return hasAnyPermission(user, kuaizhizaoPricingViewPermissionCodes(resource));
}
