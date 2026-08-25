import { layoutShellQueryOptions } from './reactQuery';
import { getCurrentUser } from '../services/auth';
import { getCurrentInfraSuperAdmin } from '../services/infraAdmin';
import { getSiteSetting, type SiteSetting } from '../services/siteSetting';
import { getUserPreference, type UserPreference } from '../services/userPreference';
import { getLanguageList } from '../services/language';
import { getTenantId } from '../utils/auth';
import { isRequestCancellation } from '../utils/requestCancellation';
import type { CurrentUser } from '../types/api';

export const CURRENT_USER_QUERY_ROOT = 'currentUser' as const;
export const SITE_SETTING_QUERY_ROOT = 'siteSetting' as const;
export const USER_PREFERENCE_QUERY_ROOT = 'userPreference' as const;
export const LANGUAGE_LIST_QUERY_ROOT = 'languageListActive' as const;

export function buildCurrentUserQueryKey(isInfraSuperAdmin: boolean) {
  return [CURRENT_USER_QUERY_ROOT, isInfraSuperAdmin] as const;
}

export function buildSiteSettingQueryKey(tenantId: number | string | null | undefined) {
  return [SITE_SETTING_QUERY_ROOT, tenantId ?? null] as const;
}

export function buildUserPreferenceQueryKey(
  tenantId: number | string | null | undefined,
  userId: number | string | null | undefined,
) {
  return [USER_PREFERENCE_QUERY_ROOT, tenantId ?? null, userId ?? null] as const;
}

export const languageListQueryKey = [LANGUAGE_LIST_QUERY_ROOT] as const;

export async function fetchCurrentUserRecord(isInfraSuperAdmin: boolean): Promise<CurrentUser> {
  if (isInfraSuperAdmin) {
    const infraUser = await getCurrentInfraSuperAdmin();
    const tenantId = getTenantId();
    return {
      id: infraUser.id,
      uuid: infraUser.uuid,
      username: infraUser.username,
      email: infraUser.email,
      full_name: infraUser.full_name,
      avatar: infraUser.avatar,
      is_infra_admin: true,
      is_tenant_admin: false,
      tenant_id: tenantId ?? undefined,
      user_type: 'infra_superadmin',
    };
  }
  return getCurrentUser();
}

export async function fetchSiteSettingRecord(): Promise<SiteSetting | null> {
  try {
    return await getSiteSetting();
  } catch (error) {
    if (isRequestCancellation(error)) throw error;
    return null;
  }
}

export async function fetchUserPreferenceRecord(): Promise<UserPreference | null> {
  try {
    return await getUserPreference();
  } catch (error) {
    if (isRequestCancellation(error)) throw error;
    return null;
  }
}

export async function fetchActiveLanguageList() {
  try {
    return await getLanguageList({ page_size: 20, is_active: true });
  } catch (error) {
    if (isRequestCancellation(error)) throw error;
    return null;
  }
}

export const siteSettingQueryOptions = {
  ...layoutShellQueryOptions,
  staleTime: 2 * 60 * 1000,
} as const;

export const userPreferenceQueryOptions = {
  ...layoutShellQueryOptions,
  staleTime: 2 * 60 * 1000,
} as const;
