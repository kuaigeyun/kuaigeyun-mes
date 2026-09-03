/**
 * 引用资源展示（下拉搜索 / 回显），与资源 read 权限解耦。
 */

import { requestDisplayResolve, requestDisplaySearch, ReferenceDisplayAccessError } from '../services/displayContract';
import type { CurrentUser } from '../types/api';
import { hasPermission } from './permission';

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

export { ReferenceDisplayAccessError };

/** 与后端 display-search page_size 上限一致 */
export const REFERENCE_DISPLAY_MAX_PAGE_SIZE = 200;

function displayPermissionCodes(resourceKey: string): [string, string] {
  const key = resourceKey.trim().toLowerCase();
  return [`${key}:read`, `${key}:display`];
}

/** 统一策略：前端不做 display 显式权限直判，交由后端统一裁决。 */
export function canPickReferenceDisplayExplicit(
  user: CurrentUser | undefined,
  _resourceKey: string,
): boolean {
  return Boolean(user);
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
  return requestDisplaySearch<ReferenceDisplayListResponse>(
    '/core/reference/display-search',
    {
      resource: args.resource,
      keyword: args.keyword,
      page: args.page ?? 1,
      page_size: args.pageSize ?? 50,
      is_active: args.isActive ?? true,
      host_resource: args.hostResource,
      group_id: args.groupId,
      source_type: args.sourceType,
    },
  );
}

/** 分页拉取引用展示列表（突破单页 200 条上限） */
export async function searchReferenceDisplayAll(
  args: Omit<Parameters<typeof searchReferenceDisplay>[0], 'page' | 'pageSize'>,
  maxItems = 2000,
): Promise<ReferenceDisplayItem[]> {
  const pageSize = REFERENCE_DISPLAY_MAX_PAGE_SIZE;
  const items: ReferenceDisplayItem[] = [];
  let page = 1;
  while (items.length < maxItems) {
    const res = await searchReferenceDisplay({ ...args, page, pageSize });
    items.push(...(res.items ?? []));
    const batchLen = res.items?.length ?? 0;
    if (batchLen < pageSize || items.length >= (res.total ?? items.length)) {
      break;
    }
    page += 1;
  }
  return items.slice(0, maxItems);
}

export async function resolveReferenceDisplay(args: {
  resource: string;
  recordIds?: number[];
  recordUuids?: string[];
  hostResource?: string;
}): Promise<ReferenceDisplayItem[]> {
  const res = await requestDisplayResolve<{ items: ReferenceDisplayItem[] }>(
    '/core/reference/display-resolve',
    {
      resource: args.resource,
      record_ids: args.recordIds ?? [],
      record_uuids: args.recordUuids ?? [],
      host_resource: args.hostResource,
    },
  );
  return res.items ?? [];
}

/** 将引用展示项转为 id 下拉选项 */
export function referenceDisplayToIdOptions(
  items: ReferenceDisplayItem[],
): { label: string; value: number }[] {
  return items
    .filter((i) => i.id != null)
    .map((i) => ({ label: formatReferenceDisplayLabel(i), value: i.id as number }));
}

function extraStr(extra: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const raw = extra[key];
    if (raw == null) continue;
    const text = String(raw).trim();
    if (text) return text;
  }
  return undefined;
}

function extraNum(extra: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const raw = extra[key];
    if (raw == null || raw === '') continue;
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** 客商引用展示 → 下拉实体（含联系人快照等 extra，供单据表单自动带出） */
export function mapPartnerReferenceDisplayItem(item: ReferenceDisplayItem): {
  id: number;
  uuid?: string;
  code?: string;
  name?: string;
  contactPerson?: string;
  phone?: string;
  address?: string;
  deliveryAddress?: string;
  salesmanId?: number;
  salesmanName?: string;
  paymentTermsDays?: number;
  buyerId?: number;
  buyerName?: string;
} {
  const extra = (item.extra && typeof item.extra === 'object' ? item.extra : {}) as Record<
    string,
    unknown
  >;
  return {
    id: Number(item.id),
    uuid: item.uuid ?? undefined,
    code: item.code ?? undefined,
    name: item.name ?? undefined,
    contactPerson: extraStr(extra, 'contact_person', 'contactPerson'),
    phone: extraStr(extra, 'phone'),
    address: extraStr(extra, 'address'),
    deliveryAddress: extraStr(extra, 'delivery_address', 'deliveryAddress'),
    salesmanId: extraNum(extra, 'salesman_id', 'salesmanId'),
    salesmanName: extraStr(extra, 'salesman_name', 'salesmanName'),
    paymentTermsDays: extraNum(extra, 'payment_terms_days', 'paymentTermsDays'),
    buyerId: extraNum(extra, 'buyer_id', 'buyerId'),
    buyerName: extraStr(extra, 'buyer_name', 'buyerName'),
  };
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
