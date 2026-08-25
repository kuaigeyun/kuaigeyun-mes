import { apiRequest } from '../../../services/api';

const BASE = '/apps/spoke-wheel';

export const spokeWheelGet = <T = any>(path: string, params?: Record<string, unknown>) =>
  apiRequest(`${BASE}${path}`, { method: 'GET', params }) as Promise<T>;

export const spokeWheelPost = <T = any>(path: string, data?: any) =>
  apiRequest(`${BASE}${path}`, { method: 'POST', data }) as Promise<T>;

export const spokeWheelPatch = <T = any>(path: string, data?: any) =>
  apiRequest(`${BASE}${path}`, { method: 'PATCH', data }) as Promise<T>;

export const spokeWheelDelete = (path: string) =>
  apiRequest(`${BASE}${path}`, { method: 'DELETE' }) as Promise<any>;