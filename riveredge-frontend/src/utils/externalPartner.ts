/**
 * 外协身份判定 — 与后端 `user_is_external_partner` 逐字对齐。
 * 唯一真源：DB 字段 role_type=external 且 external_partner_type 非空。
 * 禁止：角色 code/name 正则、权限集合猜测、缺字段时默认 internal/厂内。
 */

import type { CurrentUser } from '../types/api';

/** 与 `_data_scope.user_is_external_partner` 相同判定式 */
export function userIsExternalPartner(user: CurrentUser | undefined | null): boolean {
  if (!user) return false;
  return (user.roles ?? []).some((r) => {
    const roleType = String(r.role_type ?? '').trim().toLowerCase();
    const partnerType = String(r.external_partner_type ?? '').trim();
    return roleType === 'external' && partnerType.length > 0;
  });
}

/** 账号类型展示：缺 role_type 时不猜测，显示 — */
export function accountTypeLabel(user: CurrentUser | undefined | null): '厂内' | '外协' | '—' {
  const roles = user?.roles ?? [];
  if (!roles.length) return '—';
  const hasRoleType = roles.some((r) => String(r.role_type ?? '').trim().length > 0);
  if (!hasRoleType) return '—';
  return userIsExternalPartner(user) ? '外协' : '厂内';
}
