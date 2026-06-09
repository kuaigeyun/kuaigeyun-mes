/**
 * 引用资源展示（下拉搜索 / 回显），与资源 read 权限解耦。
 */

import { apiRequest } from '../services/api';
import type { CurrentUser } from '../types/api';
import { hasAnyPermission, hasPermission } from './permission';

export interface ReferenceDisplayItem {
  id?: number | null;
  uuid?: string | null;
  code?: string | null;
  name?: string | null;
  label: string;
  extra?: Record<string, unknown>;
}

export interface ReferenceDisplayListResponse {
  items: ReferenceDisplayItem[];
  total: number;
  page: number;
  page_size: number;
}

export class ReferenceDisplayAccessError extends Error {
  readonly status: number;
  readonly required?: string[];

  constructor(message: string, status = 403, required?: string[]) {
    super(message);
    this.name = 'ReferenceDisplayAccessError';
    this.status = status;
    this.required = required;
  }
}

function displayPermissionCodes(resourceKey: string): [string, string] {
  const key = resourceKey.trim().toLowerCase();
  return [`${key}:read`, `${key}:display`];
}

/** 是否具备显式 read/display（不含宿主隐式授予，隐式由后端判定） */
export function canPickReferenceDisplayExplicit(
  user: CurrentUser | undefined,
  resourceKey: string,
): boolean {
  const [read, display] = displayPermissionCodes(resourceKey);
  return hasAnyPermission(user, [read, display]);
}

export function formatReferenceDisplayLabel(item: ReferenceDisplayItem): string {
  if (item.label?.trim()) return item.label.trim();
  const code = (item.code || '').trim();
  const name = (item.name || '').trim();
  if (code && name) return `${code} - ${name}`;
  if (name) return name;
  if (code) return code;
  if (item.id != null) return String(item.id);
  return '';
}

export async function searchReferenceDisplay(args: {
  resource: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
  isActive?: boolean;
  hostResource?: string;
  groupId?: number;
  sourceType?: string;
}): Promise<ReferenceDisplayListResponse> {
  try {
    return await apiRequest<ReferenceDisplayListResponse>('/core/reference/display-search', {
      params: {
        resource: args.resource,
        keyword: args.keyword,
        page: args.page ?? 1,
        page_size: args.pageSize ?? 50,
        is_active: args.isActive ?? true,
        host_resource: args.hostResource,
        group_id: args.groupId,
        source_type: args.sourceType,
      },
    });
  } catch (err: unknown) {
    throw mapReferenceDisplayError(err);
  }
}

export async function resolveReferenceDisplay(args: {
  resource: string;
  recordIds?: number[];
  recordUuids?: string[];
  hostResource?: string;
}): Promise<ReferenceDisplayItem[]> {
  try {
    const res = await apiRequest<{ items: ReferenceDisplayItem[] }>('/core/reference/display-resolve', {
      method: 'POST',
      data: {
        resource: args.resource,
        record_ids: args.recordIds ?? [],
        record_uuids: args.recordUuids ?? [],
        host_resource: args.hostResource,
      },
    });
    return res.items ?? [];
  } catch (err: unknown) {
    throw mapReferenceDisplayError(err);
  }
}

function mapReferenceDisplayError(err: unknown): ReferenceDisplayAccessError {
  if (err && typeof err === 'object') {
    const e = err as { status?: number; message?: string; data?: { details?: { required?: string[] } } };
    if (e.status === 403) {
      return new ReferenceDisplayAccessError(
        e.message || '无权引用该资源，请联系管理员配置宿主单据或引用资源权限',
        403,
        e.data?.details?.required,
      );
    }
  }
  return new ReferenceDisplayAccessError(
    err instanceof Error ? err.message : '引用资源加载失败',
    500,
  );
}

/** 将引用展示项转为 id 下拉选项 */
export function referenceDisplayToIdOptions(
  items: ReferenceDisplayItem[],
): { label: string; value: number }[] {
  return items
    .filter((i) => i.id != null)
    .map((i) => ({ label: formatReferenceDisplayLabel(i), value: i.id as number }));
}

/** 宿主模块 resource（{app}:{module}） */
export function buildHostResource(app: string, module: string): string {
  return `${app.trim()}:${module.trim()}`.toLowerCase();
}

/** 是否具备资源 read（管理页） */
export function canReadReferenceResource(user: CurrentUser | undefined, resourceKey: string): boolean {
  const [read] = displayPermissionCodes(resourceKey);
  return hasPermission(user, read);
}
