/**
 * 人员展示（选人/回显）与 system:user:read 解耦。
 */

import {
  getUserList,
  resolveUserDisplay,
  searchUserDisplay,
  type User,
  type UserDisplayItem,
} from '../services/user';
import type { CurrentUser } from '../types/api';
import { hasPermission } from './permission';

export const PERM_USER_READ = 'system:user:read';

export function canReadUserDirectory(user: CurrentUser | undefined): boolean {
  return hasPermission(user, PERM_USER_READ);
}

/**
 * 统一策略：前端不再对 display 做显式权限直判。
 * 只要已登录即可发起请求，是否允许由后端 reference_display 统一裁决。
 */
export function canPickUsersForDisplay(user: CurrentUser | undefined): boolean {
  return Boolean(user);
}

export function formatUserDisplayLabel(item: {
  full_name?: string | null;
  username?: string | null;
  label?: string | null;
  id?: number;
}): string {
  if (item.label?.trim()) return item.label.trim();
  const name = (item.full_name || '').trim();
  const login = (item.username || '').trim();
  if (name && login) return `${name} (${login})`;
  if (name) return name;
  if (login) return login;
  if (item.id != null) return `用户#${item.id}`;
  return '';
}

/** 统一人名展示：去掉尾部括号内账号/ID，如 "张三 (u005)" -> "张三" */
export function normalizeUserDisplayName(value: unknown): string {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.replace(/\s*\([^()]*\)\s*$/, '').trim();
}

function displayItemToIdOption(item: UserDisplayItem): { label: string; value: number } {
  return { label: item.label || formatUserDisplayLabel(item), value: item.id };
}

function userToIdOption(u: {
  id: number;
  full_name?: string | null;
  username: string;
}): { label: string; value: number } {
  return { label: formatUserDisplayLabel(u), value: u.id };
}

function mergeSelectedIdOptions(
  opts: { label: string; value: number }[],
  selectedIds: number[],
  labelById: Map<number, string>,
): { label: string; value: number }[] {
  const next = opts.slice();
  for (const id of selectedIds) {
    if (!Number.isFinite(id) || next.some((o) => o.value === id)) continue;
    next.unshift({ value: id, label: labelById.get(id) || `用户#${id}` });
  }
  return next;
}

/** ProFormSelect request：按用户 id 搜索（目录读权限优先，否则走展示 API） */
export async function searchUserIdOptions(args: {
  keyword?: string;
  pageSize?: number;
  departmentUuid?: string;
  positionUuid?: string;
  isActive?: boolean;
  selectedIds?: number[];
  labelById?: Map<number, string>;
  currentUser?: CurrentUser;
}): Promise<{ label: string; value: number }[]> {
  const {
    keyword,
    pageSize = 50,
    departmentUuid,
    positionUuid,
    isActive = true,
    selectedIds = [],
    labelById = new Map<number, string>(),
    currentUser,
  } = args;

  if (!canPickUsersForDisplay(currentUser)) {
    return mergeSelectedIdOptions([], selectedIds, labelById);
  }

  const keywordText =
    typeof keyword === 'string'
      ? keyword.trim() || undefined
      : undefined;

  let opts: { label: string; value: number }[] = [];
  if (canReadUserDirectory(currentUser)) {
    const res = await getUserList({
      page: 1,
      page_size: pageSize,
      keyword: keywordText,
      ...(isActive !== undefined ? { is_active: isActive } : {}),
      ...(departmentUuid ? { department_uuid: departmentUuid } : {}),
      ...(positionUuid ? { position_uuid: positionUuid } : {}),
    });
    opts = (res.items || []).map(userToIdOption);
  } else {
    const res = await searchUserDisplay({
      page: 1,
      page_size: pageSize,
      keyword: keywordText,
      ...(isActive !== undefined ? { is_active: isActive } : {}),
      ...(departmentUuid ? { department_uuid: departmentUuid } : {}),
      ...(positionUuid ? { position_uuid: positionUuid } : {}),
    });
    opts = (res.items || []).map(displayItemToIdOption);
  }

  const missing = selectedIds.filter((id) => Number.isFinite(id) && !opts.some((o) => o.value === id));
  if (missing.length && canPickUsersForDisplay(currentUser)) {
    try {
      const resolved = await resolveUserDisplay({ user_ids: missing });
      for (const u of resolved) {
        labelById.set(u.id, u.label || formatUserDisplayLabel(u));
        if (!opts.some((o) => o.value === u.id)) {
          opts.unshift(displayItemToIdOption(u));
        }
      }
    } catch {
      /* 保留占位 */
    }
  }

  return mergeSelectedIdOptions(opts, selectedIds, labelById);
}

/** ProFormSelect request：值为姓名字符串（如 handler_name） */
export async function searchUserNameOptions(args: {
  keyword?: string;
  pageSize?: number;
  selectedName?: string;
  currentUser?: CurrentUser;
}): Promise<{ label: string; value: string }[]> {
  const { keyword, pageSize = 50, selectedName, currentUser } = args;
  const idOpts = await searchUserIdOptions({
    keyword,
    pageSize,
    currentUser,
  });
  const opts = idOpts.map((o) => ({ label: o.label, value: o.label }));
  const sel = (selectedName || '').trim();
  if (sel && !opts.some((o) => o.value === sel)) {
    opts.unshift({ label: sel, value: sel });
  }
  return opts;
}

/** 编辑回显：批量解析用户 id → 展示名 */
/** 将 display API 结果转为页面沿用的 User 列表（仅含展示/选人必要字段） */
export function displayItemsToUsers(items: UserDisplayItem[]): User[] {
  return items.map((u) => ({
    id: u.id,
    uuid: u.uuid,
    username: u.username,
    full_name: u.full_name ?? undefined,
    is_active: true,
    is_tenant_admin: false,
    tenant_id: 0,
    created_at: '',
    updated_at: '',
  }));
}

export async function resolveUserIdLabels(
  userIds: number[],
  currentUser?: CurrentUser,
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  const ids = userIds.filter((id) => Number.isFinite(id) && id > 0);
  if (!ids.length || !canPickUsersForDisplay(currentUser)) return map;
  try {
    const items = await resolveUserDisplay({ user_ids: ids });
    for (const u of items) {
      map.set(u.id, u.label || formatUserDisplayLabel(u));
    }
  } catch {
    /* ignore */
  }
  return map;
}
