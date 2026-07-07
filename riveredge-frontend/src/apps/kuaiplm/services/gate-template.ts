/**
 * 阶段门模板 API
 */

import { apiRequest } from '../../../services/api';

const BASE = '/apps/kuaiplm/gate-templates';

export type GateProjectType = 'RD' | 'DELIVERY';
export type GateMilestoneRole = 'none' | 'spawn_delivery';

export interface GateTemplateDeliverable {
  id?: number;
  uuid?: string;
  stage_id?: number;
  name: string;
  deliverable_type?: string | null;
  sort_order?: number;
}

export interface GateTemplateStage {
  id?: number;
  uuid?: string;
  template_id?: number;
  gate_key: string;
  gate_name: string;
  sort_order: number;
  milestone_role: GateMilestoneRole;
  deliverables?: GateTemplateDeliverable[];
}

export interface GateTemplateSummary {
  id: number;
  uuid?: string;
  tenant_id?: number;
  project_type: GateProjectType;
  template_code: string;
  template_name: string;
  is_default: boolean;
  is_active: boolean;
  notes?: string | null;
  stage_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface GateTemplateDetail extends GateTemplateSummary {
  stages: GateTemplateStage[];
}

function unwrapList<T>(res: unknown): { items: T[]; total: number } {
  if (Array.isArray(res)) return { items: res as T[], total: res.length };
  const r = res as Record<string, unknown>;
  const items = (r.data ?? r.items ?? r.results ?? []) as T[];
  const total = Number(r.total ?? (Array.isArray(items) ? items.length : 0));
  return { items: Array.isArray(items) ? items : [], total };
}

export async function listGateTemplates(params?: {
  project_type?: GateProjectType;
  is_active?: boolean;
}) {
  const res = await apiRequest<unknown>(BASE, { method: 'GET', params });
  return unwrapList<GateTemplateSummary>(res);
}

export async function getGateTemplate(id: number | string) {
  return apiRequest<GateTemplateDetail>(`${BASE}/${id}`, { method: 'GET' });
}

export async function createGateTemplate(data: {
  project_type: GateProjectType;
  template_code?: string;
  template_name: string;
  notes?: string;
  copy_from_id?: number;
}) {
  return apiRequest<GateTemplateDetail>(BASE, { method: 'POST', data });
}

export async function updateGateTemplate(
  id: number | string,
  data: { template_name?: string; notes?: string; is_active?: boolean },
) {
  return apiRequest<GateTemplateDetail>(`${BASE}/${id}`, { method: 'PUT', data });
}

export async function saveGateTemplateStages(
  id: number | string,
  stages: GateTemplateStage[],
) {
  return apiRequest<GateTemplateDetail>(`${BASE}/${id}/stages`, {
    method: 'PUT',
    data: { stages },
  });
}

export async function setDefaultGateTemplate(id: number | string) {
  return apiRequest<GateTemplateDetail>(`${BASE}/${id}/set-default`, { method: 'POST' });
}

export async function deleteGateTemplate(id: number | string) {
  return apiRequest<void>(`${BASE}/${id}`, { method: 'DELETE' });
}
