/**
 * 运营看板外观（顶栏标题、中间配图、参观模式，租户级，持久化在后端 infra_tenant_configs）
 */

import { apiRequest } from './api';

export interface BusinessBoardVisitMetrics {
  today_output?: number | null;
  qualified_rate?: number | null;
  in_progress_wo?: number | null;
  pending_schedule?: number | null;
  avg_cycle?: number | null;
  on_time_delivery?: number | null;
  rework_count?: number | null;
  repairing_count?: number | null;
}

export interface BusinessBoardTitlePayload {
  title: string | null;
  /** 中间配图文件 UUID，空表示使用系统默认 /img/dashboard.png */
  hero_image_uuid: string | null;
  visit_mode: boolean;
  visit_metrics: BusinessBoardVisitMetrics;
}

export const EMPTY_VISIT_METRICS: BusinessBoardVisitMetrics = {
  today_output: null,
  qualified_rate: null,
  in_progress_wo: null,
  pending_schedule: null,
  avg_cycle: null,
  on_time_delivery: null,
  rework_count: null,
  repairing_count: null,
};

export async function getBusinessBoardTitle(): Promise<BusinessBoardTitlePayload> {
  const res = await apiRequest<BusinessBoardTitlePayload>('/core/dashboard/business-board-title', {
    method: 'GET',
  });
  return {
    title: res?.title ?? null,
    hero_image_uuid: res?.hero_image_uuid ?? null,
    visit_mode: Boolean(res?.visit_mode),
    visit_metrics: { ...EMPTY_VISIT_METRICS, ...(res?.visit_metrics || {}) },
  };
}

/** title / hero / visit 均为空关则恢复默认（后端可删租户配置） */
export async function putBusinessBoardTitle(payload: {
  title: string | null;
  hero_image_uuid: string | null;
  visit_mode?: boolean | null;
  visit_metrics?: BusinessBoardVisitMetrics | null;
}): Promise<BusinessBoardTitlePayload> {
  const data: Record<string, unknown> = {
    title: payload.title && payload.title.trim() ? payload.title.trim() : null,
    hero_image_uuid: payload.hero_image_uuid?.trim() || null,
  };
  if (payload.visit_mode !== undefined && payload.visit_mode !== null) {
    data.visit_mode = Boolean(payload.visit_mode);
  }
  if (payload.visit_metrics !== undefined && payload.visit_metrics !== null) {
    data.visit_metrics = payload.visit_metrics;
  }
  const res = await apiRequest<BusinessBoardTitlePayload>('/core/dashboard/business-board-title', {
    method: 'PUT',
    data,
  });
  return {
    title: res?.title ?? null,
    hero_image_uuid: res?.hero_image_uuid ?? null,
    visit_mode: Boolean(res?.visit_mode),
    visit_metrics: { ...EMPTY_VISIT_METRICS, ...(res?.visit_metrics || {}) },
  };
}
