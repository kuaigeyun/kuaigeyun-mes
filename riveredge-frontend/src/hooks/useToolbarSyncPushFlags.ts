/**
 * 读取业务配置：工具栏「同步 / 推送」Tab 显隐（默认 true，兼容现网）。
 *
 * 与配置中心共用 `['businessConfig']` query key：保存后 setQueryData / invalidate
 * 会立刻更新已打开功能页，无需 F5。
 *
 * 热加载要点：CustomEvent / storage 触发重渲染时，优先读 queryClient.getQueryData，
 * 避免 useQuery 的 data 快照尚未刷新导致仍算出旧 flags。
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { getBusinessConfig, type BusinessConfig } from '../services/businessConfig';

/** 与配置中心 BUSINESS_CONFIG_QUERY_KEY 对齐，保证热加载 */
export const TOOLBAR_SYNC_PUSH_FLAGS_QUERY_KEY = ['businessConfig'] as const;

/** 同窗口兜底：配置中心保存后广播，已挂载功能页立刻重算 */
export const BUSINESS_CONFIG_UPDATED_EVENT = 'riveredge:business-config-updated';

/** 与 business_config.parameters.<category> 对齐 */
export type ToolbarSyncPushCategory =
  | 'work_order'
  | 'reporting'
  | 'sales'
  | 'purchase'
  | 'warehouse';

export type ToolbarSyncPushFlags = {
  syncEnabled: boolean;
  pushEnabled: boolean;
  /** 任一开启时工具栏按钮可见（SyncPushHub）；纯同步页请用 syncEnabled */
  hubVisible: boolean;
};

function resolveFlag(value: unknown, defaultValue = true): boolean {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'false' || normalized === '0' || normalized === 'off') return false;
    if (normalized === 'true' || normalized === '1' || normalized === 'on') return true;
  }
  return Boolean(value);
}

/**
 * 无 DocumentPush profile 的模块也默认开 push Tab（占位面板），与工单/报工 Hub 结构一致。
 * 业务配置仍可单独关闭 toolbar_push_enabled。
 */
const PUSH_DEFAULT_BY_CATEGORY: Record<ToolbarSyncPushCategory, boolean> = {
  work_order: true,
  reporting: true,
  sales: true,
  purchase: true,
  warehouse: true,
};

export function resolveToolbarSyncPushFlags(
  config: BusinessConfig | null | undefined,
  category: ToolbarSyncPushCategory,
): ToolbarSyncPushFlags {
  const params = config?.parameters?.[category] as Record<string, unknown> | undefined;
  const syncEnabled = resolveFlag(params?.toolbar_sync_enabled, true);
  const pushEnabled = resolveFlag(
    params?.toolbar_push_enabled,
    PUSH_DEFAULT_BY_CATEGORY[category],
  );
  return {
    syncEnabled,
    pushEnabled,
    hubVisible: syncEnabled || pushEnabled,
  };
}

const BUSINESS_CONFIG_STORAGE_KEY = 'riveredge:business-config-cache';

/** 写入 React Query 缓存并广播，供配置中心保存后立刻热加载（同窗事件 + 跨标签 localStorage） */
export function syncBusinessConfigQueryCache(
  queryClient: QueryClient,
  config: BusinessConfig,
): void {
  queryClient.setQueryData(TOOLBAR_SYNC_PUSH_FLAGS_QUERY_KEY, config);
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(BUSINESS_CONFIG_UPDATED_EVENT, { detail: config }),
  );
  try {
    // 带时间戳，确保同内容连续保存仍触发 storage 事件
    window.localStorage.setItem(
      BUSINESS_CONFIG_STORAGE_KEY,
      JSON.stringify({ ts: Date.now(), config }),
    );
  } catch {
    // 隐私模式 / 配额满时忽略跨标签同步
  }
}

/** 乐观合并 parameters 补丁到现有 businessConfig 缓存 */
export function patchBusinessConfigQueryCache(
  queryClient: QueryClient,
  patch: Record<string, Record<string, unknown>>,
  fallback?: BusinessConfig | null,
): BusinessConfig {
  const prev = queryClient.getQueryData<BusinessConfig>(TOOLBAR_SYNC_PUSH_FLAGS_QUERY_KEY);
  const base = prev?.parameters || fallback?.parameters || {};
  const nextParameters: Record<string, Record<string, unknown>> = { ...base };
  for (const [cat, catPatch] of Object.entries(patch)) {
    nextParameters[cat] = {
      ...(nextParameters[cat] || {}),
      ...catPatch,
    };
  }
  const next: BusinessConfig = {
    ...(prev || fallback || { parameters: {} }),
    parameters: nextParameters as BusinessConfig['parameters'],
  };
  syncBusinessConfigQueryCache(queryClient, next);
  return next;
}

export function useToolbarSyncPushFlags(category: ToolbarSyncPushCategory): ToolbarSyncPushFlags {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: TOOLBAR_SYNC_PUSH_FLAGS_QUERY_KEY,
    queryFn: getBusinessConfig,
    staleTime: 60_000,
  });

  // 同窗口自定义事件 + 跨标签 storage + queryCache：强制在广播后重算
  const [eventTick, setEventTick] = useState(0);
  useEffect(() => {
    const bump = () => setEventTick((n) => n + 1);
    const applyConfig = (config: BusinessConfig | undefined) => {
      if (config?.parameters) {
        queryClient.setQueryData(TOOLBAR_SYNC_PUSH_FLAGS_QUERY_KEY, config);
      }
      bump();
    };
    const onUpdated = (ev: Event) => {
      applyConfig((ev as CustomEvent<BusinessConfig>).detail);
    };
    const onStorage = (ev: StorageEvent) => {
      if (ev.key !== BUSINESS_CONFIG_STORAGE_KEY || !ev.newValue) return;
      try {
        const parsed = JSON.parse(ev.newValue) as { config?: BusinessConfig };
        applyConfig(parsed?.config);
      } catch {
        // ignore malformed payload
      }
    };
    const unsubCache = queryClient.getQueryCache().subscribe((event) => {
      const key = event?.query?.queryKey;
      if (
        Array.isArray(key) &&
        key[0] === TOOLBAR_SYNC_PUSH_FLAGS_QUERY_KEY[0] &&
        (event.type === 'updated' || event.type === 'observerResultsUpdated')
      ) {
        bump();
      }
    });
    window.addEventListener(BUSINESS_CONFIG_UPDATED_EVENT, onUpdated);
    window.addEventListener('storage', onStorage);
    return () => {
      unsubCache();
      window.removeEventListener(BUSINESS_CONFIG_UPDATED_EVENT, onUpdated);
      window.removeEventListener('storage', onStorage);
    };
  }, [queryClient]);

  return useMemo(() => {
    // 关键：eventTick 触发的那一帧，useQuery.data 可能仍是旧快照
    const live =
      queryClient.getQueryData<BusinessConfig>(TOOLBAR_SYNC_PUSH_FLAGS_QUERY_KEY) ?? data;
    return resolveToolbarSyncPushFlags(live, category);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- eventTick 有意列入
  }, [data, category, eventTick, queryClient]);
}
