/**
 * 保密文件库：二次密码解锁会话（sessionStorage，关页即失效）。
 */

import { apiRequest } from './api';

export const PRIVATE_VAULT_TOKEN_HEADER = 'X-Private-Vault-Token';
export const PRIVATE_VAULT_SCOPE_HEADER = 'X-Private-Vault-Scope';
export const FILE_MANAGER_VAULT_SCOPE = 'file-manager';

const TOKEN_KEY = 'private_file_vault_token';
const EXPIRES_AT_KEY = 'private_file_vault_expires_at';

export interface PrivateVaultStatus {
  configured: boolean;
  categories: string[];
}

export interface PrivateVaultUnlockResult {
  token: string;
  expires_in: number;
}

export function getPrivateVaultToken(): string | null {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const expiresRaw = sessionStorage.getItem(EXPIRES_AT_KEY);
    if (!token || !expiresRaw) return null;
    const expiresAt = Number(expiresRaw);
    if (!Number.isFinite(expiresAt) || Date.now() >= expiresAt) {
      clearPrivateVaultSession();
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

export function isPrivateVaultUnlocked(): boolean {
  return Boolean(getPrivateVaultToken());
}

export function setPrivateVaultSession(token: string, expiresInSeconds: number): void {
  const expiresAt = Date.now() + Math.max(0, expiresInSeconds) * 1000;
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(EXPIRES_AT_KEY, String(expiresAt));
}

export function clearPrivateVaultSession(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(EXPIRES_AT_KEY);
}

export function privateVaultRequestHeaders(): Record<string, string> {
  const token = getPrivateVaultToken();
  return token ? { [PRIVATE_VAULT_TOKEN_HEADER]: token } : {};
}

/** 文件管理页浏览/改删保密文件时附带 scope + 令牌 */
export function privateVaultFileManagerHeaders(): Record<string, string> {
  return {
    [PRIVATE_VAULT_SCOPE_HEADER]: FILE_MANAGER_VAULT_SCOPE,
    ...privateVaultRequestHeaders(),
  };
}

export async function getPrivateVaultStatus(): Promise<PrivateVaultStatus> {
  return apiRequest<PrivateVaultStatus>('/core/files/private-vault/status');
}

export async function unlockPrivateVault(password: string): Promise<PrivateVaultUnlockResult> {
  const result = await apiRequest<PrivateVaultUnlockResult>('/core/files/private-vault/unlock', {
    method: 'POST',
    data: { password },
  });
  setPrivateVaultSession(result.token, result.expires_in);
  return result;
}

export async function setPrivateVaultPassword(password: string): Promise<void> {
  await apiRequest<void>('/core/files/private-vault/set-password', {
    method: 'POST',
    data: { password },
  });
}

export async function changePrivateVaultPassword(
  oldPassword: string,
  newPassword: string,
): Promise<void> {
  await apiRequest<void>('/core/files/private-vault/change-password', {
    method: 'POST',
    data: { old_password: oldPassword, new_password: newPassword },
  });
}
