/**
 * 租户初始化 API 服务
 *
 * 提供统一初始化数据加载接口。
 */

import { apiRequest } from './api';

export interface InitItem {
  key: string;
  name: string;
  description: string;
}

export interface InitConfigResponse {
  required: InitItem[];
  optional: InitItem[];
}

export interface RunInitResponse {
  results: Record<string, { success: boolean; created?: number; error?: string }>;
  message: string;
}

export interface IndustryPreset {
  code: string;
  name: string;
  description: string;
  keys: string[];
}

export interface BootstrapStep {
  key: string;
  name: string;
  description: string;
}

export interface BootstrapStatusResponse {
  pending: boolean;
  bootstrap_completed: boolean;
  steps: BootstrapStep[];
}

export interface RunBootstrapStepResponse {
  key: string;
  success: boolean;
  created?: number;
  error?: string;
}

/**
 * 获取首次引导初始化状态
 */
export async function getBootstrapStatus(): Promise<BootstrapStatusResponse> {
  return apiRequest<BootstrapStatusResponse>('/core/tenant-init/bootstrap-status', {
    method: 'GET',
  });
}

/**
 * 执行单步引导初始化
 */
export async function runBootstrapStep(key: string): Promise<RunBootstrapStepResponse> {
  return apiRequest<RunBootstrapStepResponse>('/core/tenant-init/run-bootstrap-step', {
    method: 'POST',
    data: { key },
  });
}

/**
 * 完成首次引导初始化
 */
export async function completeBootstrap(): Promise<{ success: boolean; message: string }> {
  return apiRequest<{ success: boolean; message: string }>('/core/tenant-init/complete-bootstrap', {
    method: 'POST',
  });
}

/**
 * 获取初始化项配置
 */
export async function getInitConfig(): Promise<InitConfigResponse> {
  return apiRequest<InitConfigResponse>('/core/tenant-init/config', {
    method: 'GET',
  });
}

/**
 * 执行全部必备系统初始项（与新建租户自动加载一致，可重复执行补全）
 */
export async function runRequiredInitItems(): Promise<RunInitResponse> {
  return apiRequest<RunInitResponse>('/core/tenant-init/run-required', {
    method: 'POST',
  });
}

/**
 * 执行选中的初始化项
 */
export async function runInitItems(keys: string[]): Promise<RunInitResponse> {
  return apiRequest<RunInitResponse>('/core/tenant-init/run', {
    method: 'POST',
    data: { keys },
  });
}

/**
 * 获取可用行业预设模板
 */
export async function getIndustryPresets(): Promise<IndustryPreset[]> {
  return apiRequest<IndustryPreset[]>('/core/tenant-init/industry-presets', {
    method: 'GET',
  });
}

