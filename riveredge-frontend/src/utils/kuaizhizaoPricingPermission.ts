/**
 * 快制造应用内「价格/金额是否可见」统一权限点。
 * 角色勾选 kuaizhizao:pricing:view 后，所有使用 AmountDisplay / canViewKuaizhizaoPricing 的金额展示可见。
 * 仍兼容历史码 {resource}:view:amount（如 sales_order:view:amount）。
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
