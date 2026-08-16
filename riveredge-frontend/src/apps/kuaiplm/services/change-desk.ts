/**
 * ECR/ECO 变更工作台：聚合 master-data BOM/路线变更 + kuaiplm 统一视图
 */

import { apiRequest } from '../../../services/api';

const KUAIPLM_CHANGES = '/apps/kuaiplm/changes';

export type ChangeDeskCategory = 'bom' | 'route' | 'drawing';
export type DeskApiChangeType = 'bom' | 'process_route' | 'drawing';

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
  updated_by_name?: string;
  created_at?: string;
  updated_at?: string;
  source?: 'master_data' | 'kuaiplm';
  audit?: {
    entity_type?: string;
    phase?: string;
    enabled?: boolean;
    allowed_actions?: string[];
  };
}

function auditNodeKeyForRow(row: UnifiedChangeRow): string {
  if (row.change_category === 'route') return 'process_route_change';
  if (row.change_category === 'drawing') return 'drawing_change';
  return 'bom_change';
}

export interface ChangeListParams {
  skip?: number;
  limit?: number;
  page?: number;
  page_size?: number;
  status?: string;
  change_category?: ChangeDeskCategory;
  keyword?: string;
  change_code?: string;
  target_name?: string;
  created_start_date?: string;
  created_end_date?: string;
  updated_start_date?: string;
  updated_end_date?: string;
}

function unwrapList<T>(res: unknown): { items: T[]; total: number } {
  if (Array.isArray(res)) return { items: res as T[], total: res.length };
  const r = res as Record<string, unknown>;
  const items = (r.items ?? r.data ?? r.results ?? []) as T[];
  const total = Number(r.total ?? (Array.isArray(items) ? items.length : 0));
  return { items: Array.isArray(items) ? items : [], total };
}

function mapDeskItem(row: Record<string, unknown>): UnifiedChangeRow {
  const categoryRaw = String(row.category ?? row.change_type ?? '');
  const changeCategory: ChangeDeskCategory =
    categoryRaw === 'process_route' || categoryRaw === 'route'
      ? 'route'
      : categoryRaw === 'drawing'
        ? 'drawing'
        : 'bom';
  const extra = (row.extra ?? {}) as Record<string, unknown>;
  const detailChangeType = row.category
    ? String(row.change_type ?? '')
    : categoryRaw === 'bom' || categoryRaw === 'process_route'
      ? ''
      : String(row.change_type ?? '');
  return {
    id: row.id as string | number | undefined,
    uuid: row.uuid as string | undefined,
    change_category: changeCategory,
    change_code: (row.entity_code ?? row.change_code ?? extra.bom_code) as string | undefined,
    change_type: detailChangeType || undefined,
    target_name: (row.entity_name ?? row.target_name) as string | undefined,
    status: row.status as string | undefined,
    change_reason: row.change_reason as string | undefined,
    created_by_name: row.created_by_name as string | undefined,
    updated_by_name: row.updated_by_name as string | undefined,
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
    source: 'kuaiplm',
    audit: row.audit as UnifiedChangeRow['audit'],
  };
}

function deskChangeType(category?: ChangeDeskCategory): DeskApiChangeType | undefined {
  if (category === 'bom') return 'bom';
  if (category === 'route') return 'process_route';
  if (category === 'drawing') return 'drawing';
  return undefined;
}

export function deskApiChangeType(category: ChangeDeskCategory): DeskApiChangeType {
  return deskChangeType(category) ?? 'bom';
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
      keyword: params?.keyword,
      change_code: params?.change_code,
      target_name: params?.target_name,
      created_start_date: params?.created_start_date,
      created_end_date: params?.created_end_date,
      updated_start_date: params?.updated_start_date,
      updated_end_date: params?.updated_end_date,
    },
  });
  const { items, total } = unwrapList<Record<string, unknown>>(res);
  return { items: items.map(mapDeskItem), total };
}

export { auditNodeKeyForRow };

export async function listUnifiedChanges(params?: ChangeListParams) {
  return listFromChangeDesk(params);
}

export async function listBomChanges(params?: ChangeListParams) {
  return listFromChangeDesk(params, 'bom');
}

export async function listRouteChanges(params?: ChangeListParams) {
  return listFromChangeDesk(params, 'route');
}

export async function listDrawingChanges(params?: ChangeListParams) {
  return listFromChangeDesk(params, 'drawing');
}

export async function createDrawingChange(data: {
  drawing_uuid: string;
  drawing_change_type: string;
  change_reason?: string;
  change_content?: Record<string, unknown>;
}) {
  return apiRequest(`${KUAIPLM_CHANGES}`, {
    method: 'POST',
    data: { change_type: 'drawing', ...data },
  });
}

export async function getDrawingChange(changeUuid: string) {
  return apiRequest<Record<string, unknown>>(`${KUAIPLM_CHANGES}/${changeUuid}`, {
    method: 'GET',
    params: { change_type: 'drawing' },
  });
}

export async function approveChange(
  category: ChangeDeskCategory,
  changeUuid: string,
  comment?: string,
) {
  return approveChangeViaDesk(changeUuid, deskApiChangeType(category), comment);
}

export async function executeChange(category: ChangeDeskCategory, changeUuid: string) {
  return executeChangeViaDesk(changeUuid, deskApiChangeType(category));
}

export async function approveChangeViaDesk(
  changeUuid: string,
  changeType: DeskApiChangeType,
  comment?: string,
) {
  return apiRequest(`${KUAIPLM_CHANGES}/${changeUuid}/approve`, {
    method: 'POST',
    data: { change_type: changeType, approved: true, approval_comment: comment },
  });
}

export async function executeChangeViaDesk(
  changeUuid: string,
  changeType: DeskApiChangeType,
) {
  return apiRequest(`${KUAIPLM_CHANGES}/${changeUuid}/execute`, {
    method: 'POST',
    data: { change_type: changeType },
  });
}

export async function deleteChangeViaDesk(
  changeUuid: string,
  changeType: DeskApiChangeType,
) {
  return apiRequest(`${KUAIPLM_CHANGES}/${changeUuid}`, {
    method: 'DELETE',
    params: { change_type: changeType },
  });
}

export async function batchApproveChanges(
  items: Array<{ change_uuid: string; change_type: DeskApiChangeType }>,
  approved = true,
  approval_comment?: string,
) {
  return apiRequest<{
    success_count: number;
    failed_count: number;
    errors?: string[];
  }>(`${KUAIPLM_CHANGES}/batch/approve`, {
    method: 'POST',
    data: { items, approved, approval_comment },
  });
}

export async function batchExecuteChanges(
  items: Array<{ change_uuid: string; change_type: DeskApiChangeType }>,
) {
  return apiRequest<{
    success_count: number;
    failed_count: number;
    errors?: string[];
  }>(`${KUAIPLM_CHANGES}/batch/execute`, {
    method: 'POST',
    data: { items },
  });
}

export async function batchDeleteChanges(
  items: Array<{ change_uuid: string; change_type: DeskApiChangeType }>,
) {
  return apiRequest<{
    success_count: number;
    failed_count: number;
    errors?: string[];
  }>(`${KUAIPLM_CHANGES}/batch/delete`, {
    method: 'POST',
    data: { items },
  });
}
