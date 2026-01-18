/**
 * 上线进度跟踪服务
 * 
 * 提供上线进度跟踪的API调用
 * 
 * @author Luigi Lu
 * @date 2026-01-27
 */

import { apiRequest } from './api';

/**
 * 进度阶段
 */
export interface ProgressStage {
  key: string;
  name: string;
  required: boolean;
  status: string;
  completed: boolean;
  updated_at?: string;
}

/**
 * 进度任务
 */
export interface ProgressTask {
  id: string;
  name: string;
  status: string;
  is_critical: boolean;
  is_due_soon: boolean;
  updated_at?: string;
}

/**
 * 进度跟踪信息
 */
export interface ProgressTracking {
  has_countdown: boolean;
  countdown_uuid?: string;
  launch_date?: string;
  snapshot_time?: string;
  status?: string;
  days_remaining: number;
  progress_percentage: number;
  stages: ProgressStage[];
  tasks: ProgressTask[];
}

/**
 * 进度报告
 */
export interface ProgressReport {
  generated_at: string;
  summary: {
    total_tasks: number;
    completed_tasks: number;
    pending_tasks: number;
    in_progress_tasks: number;
    completion_rate: number;
    days_remaining: number;
  };
  stages: ProgressStage[];
  tasks: ProgressTask[];
  risks: Array<{
    level: string;
    message: string;
  }>;
}

/**
 * 获取上线进度跟踪
 * 
 * @returns 进度跟踪信息
 */
export async function getProgressTracking(): Promise<ProgressTracking> {
  const response = await apiRequest('/api/v1/core/launch-progress/tracking', { method: 'GET' });
  return response.data || response;
}

/**
 * 生成进度报告
 * 
 * @returns 进度报告
 */
export async function generateProgressReport(): Promise<ProgressReport> {
  const response = await apiRequest('/api/v1/core/launch-progress/report', { method: 'GET' });
  return response.data || response;
}
