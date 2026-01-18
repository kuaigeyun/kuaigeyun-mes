/**
 * 上线检查清单服务
 * 
 * 提供上线检查清单的API调用
 * 
 * @author Luigi Lu
 * @date 2026-01-27
 */

import { apiRequest } from './api';

/**
 * 检查清单项
 */
export interface ChecklistItem {
  category: string;
  category_name: string;
  key: string;
  name: string;
  description: string;
  check_method: string;
  is_critical: boolean;
  check_status?: string;
  check_time?: string;
  check_message?: string;
}

/**
 * 检查报告
 */
export interface CheckReport {
  generated_at: string;
  summary: {
    total_items: number;
    passed_items: number;
    failed_items: number;
    pending_items: number;
    pass_rate: number;
    critical_total: number;
    critical_passed: number;
    critical_failed: number;
  };
  items: ChecklistItem[];
}

/**
 * 获取检查清单
 * 
 * @returns 检查清单
 */
export async function getChecklist(): Promise<ChecklistItem[]> {
  const response = await apiRequest('/api/v1/core/launch-checklist/checklist', { method: 'GET' });
  return response.data || response;
}

/**
 * 执行检查
 * 
 * @returns 检查结果列表
 */
export async function checkItems(): Promise<ChecklistItem[]> {
  const response = await apiRequest('/api/v1/core/launch-checklist/check', { method: 'GET' });
  return response.data || response;
}

/**
 * 生成检查报告
 * 
 * @returns 检查报告
 */
export async function generateCheckReport(): Promise<CheckReport> {
  const response = await apiRequest('/api/v1/core/launch-checklist/report', { method: 'GET' });
  return response.data || response;
}
