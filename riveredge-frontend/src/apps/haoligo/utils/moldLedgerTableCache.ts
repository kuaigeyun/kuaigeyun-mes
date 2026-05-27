/**
 * 模具台账列表：实时优先（禁用 UniTable TanStack 缓存 + 跨页/跨 Tab 强制刷新）。
 */
import type { ActionType } from '@ant-design/pro-components';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, type RefObject } from 'react';
import { useLocation } from 'react-router-dom';
import { invalidateUniTableListCache } from '../../../components/uni-table';

/** 与模具台账页 UniTable `columnPersistenceId` 保持一致 */
export const HAOLIGO_MOLD_LEDGER_TABLE_CACHE_ID = 'apps.haoligo.pages.molds.ledger';

export const HAOLIGO_MOLD_LEDGER_PATH_SUFFIX = '/molds/ledger';

export const HAOLIGO_MOLD_LEDGER_REFRESH_EVENT = 'riveredge:haoligo-mold-ledger-refresh';

const BROADCAST_CHANNEL_NAME = 'riveredge-haoligo-mold-ledger-refresh';

/** 台账页彻底关闭 TanStack 列表缓存，每次 request 直连 API */
export const HAOLIGO_MOLD_LEDGER_TANSTACK_QUERY = { enabled: false } as const;

const refreshListeners = new Set<() => void>();

let broadcastChannel: BroadcastChannel | null | undefined;

function getBroadcastChannel(): BroadcastChannel | null {
  if (broadcastChannel !== undefined) return broadcastChannel;
  if (typeof BroadcastChannel === 'undefined') {
    broadcastChannel = null;
    return null;
  }
  broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  return broadcastChannel;
}

function notifyMoldLedgerRefreshListeners(): void {
  for (const listener of refreshListeners) {
    listener();
  }
}

export function isHaoligoMoldLedgerPath(pathname: string): boolean {
  return pathname.replace(/\/$/, '').endsWith(HAOLIGO_MOLD_LEDGER_PATH_SUFFIX);
}

export function subscribeHaoligoMoldLedgerTableRefresh(listener: () => void): () => void {
  refreshListeners.add(listener);
  return () => {
    refreshListeners.delete(listener);
  };
}

function dispatchMoldLedgerRefreshSignals(): void {
  notifyMoldLedgerRefreshListeners();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(HAOLIGO_MOLD_LEDGER_REFRESH_EVENT));
  }
  getBroadcastChannel()?.postMessage({ ts: Date.now() });
}

/** 清除台账 TanStack 缓存，并通知已打开的台账页（含其它浏览器 Tab）立即 reload */
export function invalidateHaoligoMoldLedgerTableCache(queryClient: QueryClient): void {
  invalidateUniTableListCache(queryClient, HAOLIGO_MOLD_LEDGER_TABLE_CACHE_ID);
  dispatchMoldLedgerRefreshSignals();
}

function reloadMoldLedgerTable(actionRef: RefObject<ActionType | null>): void {
  const table = actionRef.current;
  if (!table) return;
  if (typeof table.reloadAndRest === 'function') {
    table.reloadAndRest();
    return;
  }
  table.reload?.();
}

/**
 * 台账页挂载：跨页 mutation、UniTabs 切回、浏览器 Tab 聚焦时强制 reload。
 * 首次进入仍由 ProTable 拉数；从其它标签页切回时额外 reload，避免列表残留旧行。
 */
export function useHaoligoMoldLedgerTableLiveRefresh(actionRef: RefObject<ActionType | null>): void {
  const queryClient = useQueryClient();
  const location = useLocation();
  const ledgerActive = isHaoligoMoldLedgerPath(location.pathname);

  useEffect(() => {
    if (!ledgerActive) return;
    invalidateUniTableListCache(queryClient, HAOLIGO_MOLD_LEDGER_TABLE_CACHE_ID);
  }, [queryClient, ledgerActive, location.key]);

  useEffect(() => {
    if (!ledgerActive) return;

    const reload = () => reloadMoldLedgerTable(actionRef);

    const unsub = subscribeHaoligoMoldLedgerTableRefresh(reload);

    const onWindowRefresh = () => reload();
    window.addEventListener(HAOLIGO_MOLD_LEDGER_REFRESH_EVENT, onWindowRefresh);

    const bc = getBroadcastChannel();
    const onBroadcast = () => reload();
    bc?.addEventListener('message', onBroadcast);

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        reload();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', reload);

    return () => {
      unsub();
      window.removeEventListener(HAOLIGO_MOLD_LEDGER_REFRESH_EVENT, onWindowRefresh);
      bc?.removeEventListener('message', onBroadcast);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', reload);
    };
  }, [actionRef, ledgerActive]);

  /** UniTabs 切回台账标签：每次路由激活都 reload（台账不接受列表缓存） */
  useEffect(() => {
    if (!ledgerActive) return;
    const frame = requestAnimationFrame(() => reloadMoldLedgerTable(actionRef));
    return () => cancelAnimationFrame(frame);
  }, [actionRef, ledgerActive, location.key]);
}
