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

/**
 * 解析 JWT Token（不验证签名，仅用于读取过期时间）
 * 
 * @param token - JWT Token
 * @returns Token 载荷数据，如果解析失败返回 null
 */
function decodeJWT(token: string): any | null {
  try {
    // JWT 格式：header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    // 解码 payload（base64url）
    const payload = parts[1];
    // 添加 padding（如果需要）
    const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
    // 替换 base64url 字符为 base64 字符
    const base64Payload = paddedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const decodedPayload = atob(base64Payload);
    return JSON.parse(decodedPayload);
  } catch (error) {
    console.warn('解析 JWT Token 失败:', error);
    return null;
  }
}

/**
 * 检查 Token 是否过期
 * 
 * @param token - JWT Token（可选，如果不提供则从 localStorage 读取）
 * @returns 如果 Token 过期或不存在返回 true，否则返回 false
 */
export function isTokenExpired(token?: string | null): boolean {
  const tokenToCheck = token || getToken();
  if (!tokenToCheck) {
    return true; // 没有 Token 视为过期
  }
  
  const payload = decodeJWT(tokenToCheck);
  if (!payload || !payload.exp) {
    return true; // 无法解析或没有过期时间，视为过期
  }
  
  // exp 是 Unix 时间戳（秒），需要转换为毫秒
  const expirationTime = payload.exp * 1000;
  const currentTime = Date.now();
  
  // 如果当前时间大于过期时间，Token 已过期
  return currentTime >= expirationTime;
}

/**
 * 获取 Token 过期时间
 * 
 * @param token - JWT Token（可选，如果不提供则从 localStorage 读取）
 * @returns Token 过期时间（毫秒时间戳），如果无法解析返回 null
 */
export function getTokenExpirationTime(token?: string | null): number | null {
  const tokenToCheck = token || getToken();
  if (!tokenToCheck) {
    return null;
  }
  
  const payload = decodeJWT(tokenToCheck);
  if (!payload || !payload.exp) {
    return null;
  }
  
  // exp 是 Unix 时间戳（秒），转换为毫秒
  return payload.exp * 1000;
}

/**
 * 获取 Token 剩余有效时间（毫秒）
 * 
 * @param token - JWT Token（可选，如果不提供则从 localStorage 读取）
 * @returns 剩余有效时间（毫秒），如果已过期或无法解析返回 0
 */
export function getTokenRemainingTime(token?: string | null): number {
  const expirationTime = getTokenExpirationTime(token);
  if (!expirationTime) {
    return 0;
  }
  
  const currentTime = Date.now();
  const remaining = expirationTime - currentTime;
  return Math.max(0, remaining); // 如果已过期，返回 0
}
