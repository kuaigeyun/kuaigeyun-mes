/**
 * 快制造侧调用快研发研发项目 API（不 import 已迁 pro 的 kuaiplm 前端包）。
 */
import { apiRequest } from '../../../services/api';

const BASE = '/apps/kuaiplm/rd-projects';

export type ProjectType = 'RD' | 'DELIVERY';

export interface RdProjectListParams {
  skip?: number;
  limit?: number;
  status?: string;
  keyword?: string;
  project_type?: ProjectType;
  project_code?: string;
  project_name?: string;
}

export interface RdProjectListItem {
  id?: number;
  project_code?: string;
  project_name?: string;
  status?: string;
}

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  DRAFT: '草稿',
  IN_PROGRESS: '进行中',
  ON_HOLD: '已暂停',
  COMPLETED: '已结案',
  CANCELLED: '已取消',
};

function unwrapList<T>(res: unknown): { items: T[]; total: number } {
  if (Array.isArray(res)) return { items: res as T[], total: res.length };
  const r = res as Record<string, unknown>;
  const items = (r.items ?? r.data ?? r.results ?? []) as T[];
  const total = Number(r.total ?? (Array.isArray(items) ? items.length : 0));
  return { items: Array.isArray(items) ? items : [], total };
}

export async function listRdProjects(params?: RdProjectListParams) {
  const res = await apiRequest<unknown>(BASE, { method: 'GET', params });
  return unwrapList<RdProjectListItem>(res);
}
