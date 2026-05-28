import type { MutableRefObject } from 'react';

/**
 * 列表页生命周期筛选 — 全局唯一约定
 *
 * | 层级 | 字段 | 用途 |
 * |------|------|------|
 * | 库表 | status / review_status | 持久化、提交/审核/删除等业务判断（禁止与列表筛选混用） |
 * | 列表 API | lifecycle_stage | 与表格「生命周期」列、钉住 Tab 一致（后端按 lifecycle 计算筛选） |
 * | 搜索表单 / 钉住条件 | lifecycle_stage | ProColumns.dataIndex、saved search search_params |
 * | 行数据展示 | lifecycle (object) | 接口返回，供 UniLifecycle 渲染，不参与筛选键名 |
 *
 * 禁止：列表 request 中同时传 lifecycle_stage 与 status 表达同一阶段筛选。
 * 禁止：钉住 Tab 使用 dataIndex `lifecycle` 或裸 `status` 作为阶段键（`lifecycle` 仅作遗留读取）。
 */

/** 搜索表单、钉住条件、列表 API 共用的阶段筛选键 */
export const LIST_LIFECYCLE_STAGE_FIELD = 'lifecycle_stage' as const;

/** @deprecated 仅兼容旧 saved search / 旧列配置，新代码勿写 */
export const LEGACY_LIST_LIFECYCLE_FIELD = 'lifecycle' as const;

/**
 * 从 UniTable 搜索参数解析生命周期阶段（展示名，如「已通过」「执行中」）。
 * 不读取 status — status 为库表字段，与展示阶段可能不一致。
 */
export function resolveListLifecycleStageFromSearch(
  searchFormValues?: Record<string, unknown> | null,
  params?: Record<string, unknown> | null,
  options?: { allowedStages?: readonly string[] },
): string | undefined {
  const s = searchFormValues ?? {};
  const p = params ?? {};
  const raw =
    s[LIST_LIFECYCLE_STAGE_FIELD] ??
    s[LEGACY_LIST_LIFECYCLE_FIELD] ??
    p[LIST_LIFECYCLE_STAGE_FIELD] ??
    p[LEGACY_LIST_LIFECYCLE_FIELD];
  const stage = raw != null ? String(raw).trim() : '';
  if (!stage) {
    return undefined;
  }
  if (options?.allowedStages && !options.allowedStages.includes(stage)) {
    return undefined;
  }
  return stage;
}

/** 列表 API 使用 lifecycle_stage 筛选时构造 query 片段 */
export function toListLifecycleStageApiParams(
  stage: string | undefined,
): { lifecycle_stage?: string } {
  return stage ? { lifecycle_stage: stage } : {};
}

function isSearchParamEmpty(value: unknown): boolean {
  if (value === undefined || value === null || value === '') {
    return true;
  }
  if (Array.isArray(value) && value.length === 0) {
    return true;
  }
  return false;
}

/** 从已提交的 searchParamsRef 条目读取阶段（单对象，非 searchForm+params 合并） */
export function pickListLifecycleStageFromParams(
  params?: Record<string, unknown> | null,
): string | undefined {
  if (!params) {
    return undefined;
  }
  const raw = params[LIST_LIFECYCLE_STAGE_FIELD] ?? params[LEGACY_LIST_LIFECYCLE_FIELD];
  const stage = raw != null ? String(raw).trim() : '';
  return stage || undefined;
}

/**
 * 写入 searchParamsRef 前的规范形：生命周期只保留 lifecycle_stage，去掉遗留 lifecycle 键。
 */
export function normalizeListPageSearchParamsForApply(
  params?: Record<string, unknown> | null,
): Record<string, unknown> | undefined {
  if (!params) {
    return undefined;
  }
  const next: Record<string, unknown> = { ...params };
  const stage = pickListLifecycleStageFromParams(next);
  delete next[LEGACY_LIST_LIFECYCLE_FIELD];
  if (stage) {
    next[LIST_LIFECYCLE_STAGE_FIELD] = stage;
  } else {
    delete next[LIST_LIFECYCLE_STAGE_FIELD];
  }

  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(next)) {
    if (key === '_filterConfig') {
      continue;
    }
    if (!isSearchParamEmpty(value)) {
      filtered[key] = value;
    }
  }
  return Object.keys(filtered).length > 0 ? filtered : undefined;
}

function stableSearchParamsKey(params: Record<string, unknown>): string {
  const keys = Object.keys(params).sort();
  return JSON.stringify(keys.map((k) => [k, params[k]]));
}

/**
 * 钉住 Tab 是否应对应当前列表筛选（与 searchParamsRef 完全一致，生命周期键已归一）。
 */
export function arePinnedSearchParamsActive(
  current?: Record<string, unknown> | null,
  saved?: Record<string, unknown> | null,
): boolean {
  const normalizedCurrent = normalizeListPageSearchParamsForApply(current);
  const normalizedSaved = normalizeListPageSearchParamsForApply(saved);
  if (!normalizedSaved) {
    return false;
  }
  if (!normalizedCurrent) {
    return false;
  }
  return stableSearchParamsKey(normalizedCurrent) === stableSearchParamsKey(normalizedSaved);
}

/** 唯一入口：更新 searchParamsRef 并通知 UI 刷新钉住高亮 */
export function commitListPageSearchParams(
  searchParamsRef: MutableRefObject<Record<string, unknown> | undefined> | undefined,
  params: Record<string, unknown> | undefined | null,
  onCommitted?: () => void,
): void {
  if (!searchParamsRef) {
    return;
  }
  searchParamsRef.current = normalizeListPageSearchParamsForApply(params) as Record<string, any> | undefined;
  onCommitted?.();
}
