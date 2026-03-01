/**
 * 认证存储 - 仅负责 SecureStore 读写，避免 api/authService 循环依赖
 * Web 平台使用 localStorage 回退（expo-secure-store 不支持 Web）
 */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_info';
const TENANT_KEY = 'tenant_id';

const isWeb = Platform.OS === 'web';

async function getItem(key: string): Promise<string | null> {
  if (isWeb && typeof localStorage !== 'undefined') {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb && typeof localStorage !== 'undefined') {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function removeItem(key: string): Promise<void> {
  if (isWeb && typeof localStorage !== 'undefined') {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function getToken(): Promise<string | null> {
  return getItem(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await setItem(TOKEN_KEY, token);
}

export async function getStoredUser(): Promise<string | null> {
  return getItem(USER_KEY);
}

export async function setStoredUser(json: string): Promise<void> {
  await setItem(USER_KEY, json);
}

export async function getStoredTenantId(): Promise<string | null> {
  return getItem(TENANT_KEY);
}

export async function setStoredTenantId(id: string): Promise<void> {
  await setItem(TENANT_KEY, id);
}

export async function clearAuth(): Promise<void> {
  await removeItem(TOKEN_KEY);
  await removeItem(USER_KEY);
  await removeItem(TENANT_KEY);
}
