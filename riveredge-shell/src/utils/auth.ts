/**
 * 认证工具函数
 * 
 * 提供 Token 管理、用户信息存储等工具函数
 */

/**
 * Token 存储键名
 */
const TOKEN_KEY = 'token';

/**
 * 刷新 Token 存储键名
 */
const REFRESH_TOKEN_KEY = 'refresh_token';

/**
 * 组织 ID 存储键名
 */
const TENANT_ID_KEY = 'tenant_id';

/**
 * 用户信息存储键名
 */
const USER_INFO_KEY = 'user_info';

/**
 * 设置 Token
 * 
 * @param token - JWT Token
 */
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * 获取 Token
 * 
 * @returns JWT Token
 */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * 移除 Token
 */
export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * 设置刷新 Token
 * 
 * @param refreshToken - 刷新 Token
 */
export function setRefreshToken(refreshToken: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

/**
 * 获取刷新 Token
 * 
 * @returns 刷新 Token
 */
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * 移除刷新 Token
 */
export function removeRefreshToken(): void {
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/**
 * 设置组织 ID
 * 
 * @param tenantId - 组织 ID
 */
export function setTenantId(tenantId: number | string): void {
  localStorage.setItem(TENANT_ID_KEY, String(tenantId));
}

/**
 * 获取组织 ID
 * 
 * @returns 组织 ID
 */
export function getTenantId(): number | null {
  const tenantId = localStorage.getItem(TENANT_ID_KEY);
  return tenantId ? parseInt(tenantId, 10) : null;
}

/**
 * 移除组织 ID
 */
export function removeTenantId(): void {
  localStorage.removeItem(TENANT_ID_KEY);
}

/**
 * 设置用户信息
 * 
 * @param userInfo - 用户信息
 */
export function setUserInfo(userInfo: any): void {
  localStorage.setItem(USER_INFO_KEY, JSON.stringify(userInfo));
}

/**
 * 获取用户信息
 * 
 * @returns 用户信息
 */
export function getUserInfo(): any | null {
  const userInfo = localStorage.getItem(USER_INFO_KEY);
  return userInfo ? JSON.parse(userInfo) : null;
}

/**
 * 移除用户信息
 */
export function removeUserInfo(): void {
  localStorage.removeItem(USER_INFO_KEY);
}

/**
 * 清除所有认证信息
 */
export function clearAuth(): void {
  removeToken();
  removeRefreshToken();
  removeTenantId();
  removeUserInfo();
}

/**
 * 检查是否已登录
 * 
 * @returns 是否已登录
 */
export function isAuthenticated(): boolean {
  return !!getToken();
}

