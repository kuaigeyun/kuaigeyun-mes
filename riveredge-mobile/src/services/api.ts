/**
 * API 基础配置
 * BASE_URL 优先级：
 * 1. EXPO_PUBLIC_API_BASE_URL（.env）
 * 2. Expo 高级设置中的 IP（hostUri，真机开发时自动同步）
 * 3. Android 模拟器：10.0.2.2
 * 4. 默认：localhost
 */

import axios from 'axios';
import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';
import { getToken, clearAuth } from './authStorage';

const API_PORT = 8200;

// 401 时回调，由 app 层设置以执行跳转登录
let on401Callback: (() => void) | null = null;
export function setOn401Callback(cb: () => void) {
  on401Callback = cb;
}

function getDefaultBaseUrl(): string {
  // 1. 优先从环境变量读取（.env 中 EXPO_PUBLIC_API_BASE_URL）
  const envUrl = typeof process !== 'undefined' && (process as any).env?.EXPO_PUBLIC_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) return envUrl.trim();

  // 2. 开发模式下，从 Expo hostUri 获取（与「高级设置」中配置的 IP 一致）
  try {
    const hostUri = Constants.expoConfig?.hostUri ?? (Constants as any).manifest?.hostUri;
    if (hostUri && typeof hostUri === 'string') {
      const host = hostUri.split(':')[0];
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return `http://${host}:${API_PORT}/api/v1`;
      }
    }
  } catch (_) {
    // 忽略
  }

  // 3. Android 模拟器：10.0.2.2 映射宿主机 localhost
  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${API_PORT}/api/v1`;
  }
  return `http://localhost:${API_PORT}/api/v1`;
}

const BASE_URL = getDefaultBaseUrl();

const instance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

// 请求拦截：注入 Token
instance.interceptors.request.use(
  async (config) => {
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截：401 时清除 token 并跳转登录
instance.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    if (error.response?.status === 401) {
      await clearAuth();
      on401Callback?.();
      return Promise.reject(error);
    }
    const message = error.response?.data?.detail || error.message || 'Network Error';
    let displayMsg = typeof message === 'string' ? message : JSON.stringify(message);
    if (displayMsg === 'Network Error' || error.code === 'ERR_NETWORK') {
      displayMsg = `无法连接服务器，请检查：\n1) 后端是否已启动（端口 ${API_PORT}）\n2) 真机：Expo 高级设置中的 IP 会自动用于 API，请确保与后端电脑 IP 一致\n3) 后端需设置 HOST=0.0.0.0 以接受内网连接\n4) 手机与电脑需在同一 WiFi`;
    }
    console.error('API Error:', error);
    Alert.alert('请求失败', displayMsg);
    return Promise.reject(error);
  }
);

export const apiRequest = async <T = any>(url: string, options: Record<string, any> = {}): Promise<T> => {
  return instance({ url, ...options }) as Promise<T>;
};

export { BASE_URL };
