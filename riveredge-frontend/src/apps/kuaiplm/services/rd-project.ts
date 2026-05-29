/**
 * 研发项目 / NPI 工作台 API
 */

import { apiRequest } from '../../../services/api';
import type { EngineeringLinkType } from './master-data-links';

const BASE = '/apps/kuaiplm/rd-projects';

export type ProjectType = 'RD' | 'DELIVERY';

export interface RdProject {
  id?: number;
  uuid?: string;
  project_code?: string;
  project_name?: string;
  project_type?: ProjectType;
  source_project_id?: number | null;
  source_project_code?: string | null;
  status?: string;
  material_id?: number | null;
  material_code?: string | null;
  material_name?: string | null;
  owner_name?: string | null;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
  current_gate_key?: string | null;
  current_gate_name?: string;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface RdProjectGate {
  id?: number;
  project_id?: number;
  gate_key?: string;
  gate_name?: string;
  sort_order?: number;
  status?: string;
  planned_date?: string | null;
  actual_date?: string | null;
  reviewer_id?: number | null;
  reviewer_name?: string | null;
  review_notes?: string | null;
  criteria?: string | null;
}

export interface RdProjectTask {
  id?: number;
  project_id?: number;
  gate_id?: number | null;
  parent_task_id?: number | null;
  task_name?: string;
  description?: string | null;
  assignee_name?: string | null;
  assignee_id?: number | null;
  status?: string;
  due_date?: string | null;
  priority?: string | null;
}

export interface RdProjectDeliverable {
  id?: number;
  project_id?: number;
  gate_id?: number | null;
  name?: string;
  description?: string | null;
  deliverable_type?: string | null;
  status?: string;
  file_url?: string | null;
  file_name?: string | null;
}

export interface RdProjectLink {
  id?: number;
  project_id?: number;
  link_type?: EngineeringLinkType | string;
  target_type?: string;
  target_name?: string | null;
  target_code?: string | null;
  target_uuid?: string | null;
  target_id?: number | null;
  material_id?: number | null;
  version?: string | null;
  notes?: string | null;
}

export interface ProjectCollaborationSummary {
  requirement_count?: number;
  design_review_count?: number;
  fmea_count?: number;
}

const WORKBENCH_NESTED_KEYS = new Set([
  'gates',
  'tasks',
  'links',
  'deliverables',
  'related_articles',
  'progress',
  'collaboration',
]);

function normalizeWorkbench(raw: Record<string, unknown>): RdProjectWorkbench {
  if (raw.project && typeof raw.project === 'object') {
    return raw as unknown as RdProjectWorkbench;
  }
  const project: Record<string, unknown> = {};
  const nested: RdProjectWorkbench = {
    gates: [],
    tasks: [],
    links: [],
    deliverables: [],
    related_articles: [],
    progress: 0,
    collaboration: {},
  };
  for (const [key, value] of Object.entries(raw)) {
    if (WORKBENCH_NESTED_KEYS.has(key)) {
      (nested as Record<string, unknown>)[key] = value;
    } else {
      project[key] = value;
    }
  }
  return { project: project as RdProject, ...nested };
}

function normalizeLinkPayload(data: Partial<RdProjectLink> & { link_label?: string; version?: string }) {
  const linkType = data.link_type === 'route' ? 'process_route' : data.link_type;
  const notes = [data.notes, data.version ? `版本: ${data.version}` : null].filter(Boolean).join('; ');
  return {
    link_type: linkType,
    target_type: linkType ?? data.target_type ?? 'other',
    target_id: data.target_id != null ? Number(data.target_id) : undefined,
    target_uuid: data.target_uuid,
    target_code: data.target_code,
    target_name: data.target_name ?? data.link_label,
    notes: notes || undefined,
  };
}

export interface RdProjectWorkbench {
  project?: RdProject;
  gates?: RdProjectGate[];
  tasks?: RdProjectTask[];
  links?: RdProjectLink[];
  deliverables?: RdProjectDeliverable[];
  related_articles?: Array<{
    id: number;
    title?: string;
    space_name?: string;
    updated_at?: string;
  }>;
  progress?: number;
  collaboration?: ProjectCollaborationSummary;
}

export interface RdProjectListParams {
  skip?: number;
  limit?: number;
  status?: string;
  lifecycle_stage?: string;
  keyword?: string;
  project_type?: ProjectType;
}

function unwrapList<T>(res: unknown): { items: T[]; total: number } {
  if (Array.isArray(res)) return { items: res as T[], total: res.length };
  const r = res as Record<string, unknown>;
  const items = (r.items ?? r.data ?? r.results ?? []) as T[];
  const total = Number(r.total ?? (Array.isArray(items) ? items.length : 0));
  return { items: Array.isArray(items) ? items : [], total };
}

export async function listRdProjects(params?: RdProjectListParams) {
  const res = await apiRequest<unknown>(BASE, { method: 'GET', params });
  return unwrapList<RdProject>(res);
}

export async function getRdProject(id: number | string) {
  return apiRequest<RdProject>(`${BASE}/${id}`);
}

export async function getRdProjectWorkbench(id: number | string) {
  const raw = await apiRequest<Record<string, unknown>>(`${BASE}/${id}/workbench`);
  return normalizeWorkbench(raw);
}

export async function createRdProject(data: Partial<RdProject>) {
  return apiRequest<RdProject>(BASE, { method: 'POST', data });
}

export async function updateRdProject(id: number | string, data: Partial<RdProject>) {
  return apiRequest<RdProject>(`${BASE}/${id}`, { method: 'PUT', data });
}

export async function deleteRdProject(id: number | string) {
  return apiRequest<void>(`${BASE}/${id}`, { method: 'DELETE' });
}

export async function spawnDeliveryProject(
  projectId: number | string,
  data?: { project_name?: string; project_code?: string; owner_id?: number; owner_name?: string },
) {
  return apiRequest<RdProject>(`${BASE}/${projectId}/spawn-delivery`, { method: 'POST', data: data ?? {} });
}

export async function pushTrialWorkOrder(
  projectId: number | string,
  data?: { quantity?: number; notes?: string },
) {
  return apiRequest<{ work_order_id?: number; work_order_code?: string }>(
    `${BASE}/${projectId}/push-trial-work-order`,
    { method: 'POST', data: data ?? {} },
  );
}

export async function createRdProjectTask(projectId: number | string, data: Partial<RdProjectTask>) {
  return apiRequest<RdProjectTask>(`${BASE}/${projectId}/tasks`, { method: 'POST', data });
}

export async function updateRdProjectTask(
  projectId: number | string,
  taskId: number | string,
  data: Partial<RdProjectTask>,
) {
  return apiRequest<RdProjectTask>(`${BASE}/${projectId}/tasks/${taskId}`, { method: 'PUT', data });
}

export async function deleteRdProjectTask(projectId: number | string, taskId: number | string) {
  return apiRequest<void>(`${BASE}/${projectId}/tasks/${taskId}`, { method: 'DELETE' });
}

export async function createRdProjectDeliverable(
  projectId: number | string,
  data: Partial<RdProjectDeliverable>,
) {
  return apiRequest<RdProjectDeliverable>(`${BASE}/${projectId}/deliverables`, { method: 'POST', data });
}

export async function updateRdProjectDeliverable(
  projectId: number | string,
  deliverableId: number | string,
  data: Partial<RdProjectDeliverable>,
) {
  return apiRequest<RdProjectDeliverable>(`${BASE}/${projectId}/deliverables/${deliverableId}`, {
    method: 'PUT',
    data,
  });
}

export async function deleteRdProjectDeliverable(
  projectId: number | string,
  deliverableId: number | string,
) {
  return apiRequest<void>(`${BASE}/${projectId}/deliverables/${deliverableId}`, { method: 'DELETE' });
}

export async function createRdProjectLink(
  projectId: number | string,
  data: Partial<RdProjectLink> & { link_label?: string; version?: string },
) {
  return apiRequest<RdProjectLink>(`${BASE}/${projectId}/links`, {
    method: 'POST',
    data: normalizeLinkPayload(data),
  });
}

export async function deleteRdProjectLink(projectId: number | string, linkId: number | string) {
  return apiRequest<void>(`${BASE}/${projectId}/links/${linkId}`, { method: 'DELETE' });
}

export async function updateRdProjectGate(
  projectId: number | string,
  gateId: number | string,
  data: Partial<RdProjectGate>,
) {
  return apiRequest<RdProjectGate>(`${BASE}/${projectId}/gates/${gateId}`, { method: 'PUT', data });
}

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  RD: '研发项目',
  DELIVERY: '交付项目',
};

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  DRAFT: '草稿',
  IN_PROGRESS: '进行中',
  ON_HOLD: '已暂停',
  COMPLETED: '已结案',
  CANCELLED: '已取消',
};

export function buildProjectStatusValueEnum(): Record<string, { text: string; status?: string }> {
  const antStatus: Record<string, string> = {
    DRAFT: 'Default',
    IN_PROGRESS: 'Processing',
    ON_HOLD: 'Warning',
    COMPLETED: 'Success',
    CANCELLED: 'Default',
  };
  return Object.fromEntries(
    Object.entries(PROJECT_STATUS_LABELS).map(([key, text]) => [
      key,
      { text, status: antStatus[key] ?? 'Default' },
    ]),
  );
}

export const TASK_STATUS_LABELS: Record<string, string> = {
  TODO: '待办',
  IN_PROGRESS: '进行中',
  DONE: '已完成',
  CANCELLED: '已取消',
};

export const DELIVERABLE_STATUS_LABELS: Record<string, string> = {
  PENDING: '待提交',
  SUBMITTED: '已提交',
  APPROVED: '已批准',
  REJECTED: '已驳回',
};

export const GATE_STATUS_LABELS: Record<string, string> = {
  PENDING: '待开始',
  IN_PROGRESS: '进行中',
  PASSED: '已通过',
  FAILED: '未通过',
  SKIPPED: '已跳过',
};
