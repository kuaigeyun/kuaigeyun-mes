/**
 * ECR/ECO 变更工作台：聚合 master-data BOM/路线变更 + kuaiplm 统一视图
 */

import { apiRequest } from '../../../services/api';

const KUAIPLM_CHANGES = '/apps/kuaiplm/changes';

export type ChangeDeskCategory = 'bom' | 'route';

export interface UnifiedChangeRow {
  id?: string | number;
  uuid?: string;
  change_category: ChangeDeskCategory;
  change_code?: string;
  change_type?: string;
  target_name?: string;
  target_uuid?: string;
  status?: string;
  change_reason?: string;
  created_by_name?: string;
  created_at?: string;
  updated_at?: string;
  source?: 'master_data' | 'kuaiplm';
}

export interface ChangeListParams {
  skip?: number;
  limit?: number;
  page?: number;
  page_size?: number;
  status?: string;
  change_category?: ChangeDeskCategory;
  keyword?: string;
}

function unwrapList<T>(res: unknown): { items: T[]; total: number } {
  if (Array.isArray(res)) return { items: res as T[], total: res.length };
  const r = res as Record<string, unknown>;
  const items = (r.items ?? r.data ?? r.results ?? []) as T[];
  const total = Number(r.total ?? (Array.isArray(items) ? items.length : 0));
  return { items: Array.isArray(items) ? items : [], total };
}

function mapDeskItem(row: Record<string, unknown>): UnifiedChangeRow {
  const changeType = String(row.change_type ?? '');
  const changeCategory: ChangeDeskCategory =
    changeType === 'process_route' ? 'route' : 'bom';
  const extra = (row.extra ?? {}) as Record<string, unknown>;
  return {
    uuid: row.uuid as string | undefined,
    change_category: changeCategory,
    change_code: (row.entity_code ?? row.change_code ?? extra.bom_code) as string | undefined,
    change_type: changeType,
    target_name: (row.entity_name ?? row.target_name) as string | undefined,
    status: row.status as string | undefined,
    change_reason: row.change_reason as string | undefined,
    created_at: row.created_at as string | undefined,
    source: 'kuaiplm',
  };
}

function deskChangeType(category?: ChangeDeskCategory): string | undefined {
  if (category === 'bom') return 'bom';
  if (category === 'route') return 'process_route';
  return undefined;
}

async function listFromChangeDesk(params?: ChangeListParams, category?: ChangeDeskCategory) {
  const page = params?.page ?? Math.floor((params?.skip ?? 0) / (params?.limit ?? 20)) + 1;
  const pageSize = params?.limit ?? params?.page_size ?? 20;
  const res = await apiRequest<unknown>(KUAIPLM_CHANGES, {
    method: 'GET',
    params: {
      page,
      page_size: pageSize,
      status: params?.status,
      change_type: deskChangeType(category),
    },
  });
  const { items, total } = unwrapList<Record<string, unknown>>(res);
  return { items: items.map(mapDeskItem), total };
}

export async function listUnifiedChanges(params?: ChangeListParams) {
  return listFromChangeDesk(params);
}

export async function listBomChanges(params?: ChangeListParams) {
  return listFromChangeDesk(params, 'bom');
}

export async function listRouteChanges(params?: ChangeListParams) {
  return listFromChangeDesk(params, 'route');
}

export async function approveChange(
  category: ChangeDeskCategory,
  changeUuid: string,
  comment?: string,
) {
  return approveChangeViaDesk(
    changeUuid,
    category === 'bom' ? 'bom' : 'process_route',
    comment,
  );
}

export async function executeChange(category: ChangeDeskCategory, changeUuid: string) {
  return executeChangeViaDesk(changeUuid, category === 'bom' ? 'bom' : 'process_route');
}

export async function approveChangeViaDesk(
  changeUuid: string,
  changeType: 'bom' | 'process_route',
  comment?: string,
) {
  return apiRequest(`${KUAIPLM_CHANGES}/${changeUuid}/approve`, {
    method: 'POST',
    data: { change_type: changeType, approved: true, approval_comment: comment },
  });
}

export async function executeChangeViaDesk(
  changeUuid: string,
  changeType: 'bom' | 'process_route',
) {
  return apiRequest(`${KUAIPLM_CHANGES}/${changeUuid}/execute`, {
    method: 'POST',
    data: { change_type: changeType },
  });
}
