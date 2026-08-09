import { getUserInfo, isInfraSuperAdminFromToken, isInfraSuperAdminUser } from './auth';

export function resolveIsInfraSuperAdminSession(): boolean {
  return isInfraSuperAdminUser(getUserInfo()) || isInfraSuperAdminFromToken();
}
