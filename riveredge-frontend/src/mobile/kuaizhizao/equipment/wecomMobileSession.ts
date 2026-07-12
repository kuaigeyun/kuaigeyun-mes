import { setToken, setTenantId } from '../../../utils/auth';
import { applySessionUserAfterLogin } from '../../../utils/restoredUser';
import { switchTenant } from '../../../services/auth';
import {
  tenantNameFromLoginResponse,
  type LoginResponse,
} from '../../../services/publicAuth';

/** 企微 H5 登录完成后写入会话；多组织时按应用主页指定的 tenant 切换。 */
export async function applyWecomMobileLogin(
  response: LoginResponse,
  preferredTenantId?: number,
): Promise<LoginResponse> {
  let finalResponse = response;
  setToken(response.access_token);

  const targetTenantId =
    preferredTenantId ??
    response.user?.tenant_id ??
    response.default_tenant_id ??
    undefined;

  if (response.requires_tenant_selection && targetTenantId) {
    finalResponse = await switchTenant(targetTenantId);
    setToken(finalResponse.access_token);
  }

  const selectedTenantId =
    finalResponse.user?.tenant_id ?? targetTenantId ?? finalResponse.default_tenant_id;

  if (selectedTenantId) {
    setTenantId(selectedTenantId);
  }

  const tenantName = tenantNameFromLoginResponse(finalResponse);
  applySessionUserAfterLogin({
    id: finalResponse.user.id,
    uuid: finalResponse.user.uuid,
    username: finalResponse.user.username,
    email: finalResponse.user.email,
    full_name: finalResponse.user.full_name,
    is_infra_admin: finalResponse.user.is_infra_admin,
    is_tenant_admin: finalResponse.user.is_tenant_admin,
    permissions: finalResponse.user.permissions || [],
    permission_version: finalResponse.user.permission_version || 1,
    department: finalResponse.user.department,
    position: finalResponse.user.position,
    roles: finalResponse.user.roles || [],
    tenant_id: selectedTenantId,
    tenant_name: tenantName,
    user_type: 'user',
  });

  return finalResponse;
}

export function resolveWecomMobileTenantId(
  search: string,
  getStoredTenantId: () => number | null,
): number | null {
  const params = new URLSearchParams(search);
  const fromQuery = params.get('tenant_id');
  if (fromQuery) {
    const parsed = Number(fromQuery);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  const fromSession = sessionStorage.getItem('wecom_mobile_tenant_id');
  if (fromSession) {
    const parsed = Number(fromSession);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  const fromLocal = getStoredTenantId();
  if (fromLocal && fromLocal > 0) {
    return fromLocal;
  }

  return null;
}
