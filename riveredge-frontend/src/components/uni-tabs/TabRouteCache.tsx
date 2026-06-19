import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { NavigationType, UNSAFE_LocationContext as LocationContext } from 'react-router-dom';
import type { Location } from 'react-router-dom';
import { RouteTransition } from '../route-transition';
import { isCreateTabKey } from './isCreateTabKey';

type CacheEntry = {
  node: React.ReactNode;
  refreshToken: number;
};

const routePaneStyle: React.CSSProperties = {
  flex: '1 1 auto',
  minHeight: 0,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
};

const routeTransitionStyle: React.CSSProperties = {
  ...routePaneStyle,
};

const SETTLE_MS = 200;

function parseTabKeyToLocation(tabKey: string): Location {
  const qIndex = tabKey.indexOf('?');
  const pathname = qIndex >= 0 ? tabKey.slice(0, qIndex) : tabKey;
  const search = qIndex >= 0 ? tabKey.slice(qIndex) : '';
  return {
    pathname,
    search,
    hash: '',
    state: null,
    key: `tab-cache:${tabKey}`,
  };
}

/** 缓存中的新建页使用冻结 location，避免 list/new 共用组件因全局路由变化卸载表单。 */
function TabRouteLocationScope({ tabKey, children }: { tabKey: string; children: React.ReactNode }) {
  const locationContext = useMemo(
    () => ({
      location: parseTabKeyToLocation(tabKey),
      navigationType: NavigationType.Pop,
    }),
    [tabKey],
  );
  return <LocationContext.Provider value={locationContext}>{children}</LocationContext.Provider>;
}

/**
 * UniTabs 上 `/new` 与 `/create` 标签的唯一 keep-alive 来源。
 * 普通标签由 RouteTransition 直接渲染，不参与缓存。
 */
export function TabRouteCache({
  activeKey,
  createTabKeys,
  refreshToken,
  children,
}: {
  activeKey: string;
  createTabKeys: string[];
  refreshToken: number;
  children: React.ReactNode;
}) {
  const [cache, setCache] = useState<Map<string, CacheEntry>>(() => new Map());
  const refreshByKeyRef = useRef<Map<string, number>>(new Map());
  const prevActiveKeyRef = useRef(activeKey);
  const visitedCreateTabKeysRef = useRef<Set<string>>(new Set());
  const childrenVersionRef = useRef<Map<string, number>>(new Map());
  const childrenRef = useRef(children);
  childrenRef.current = children;

  const isActiveCreate = isCreateTabKey(activeKey);

  useLayoutEffect(() => {
    if (!activeKey || !isCreateTabKey(activeKey)) return;

    const version = (childrenVersionRef.current.get(activeKey) ?? 0) + 1;
    childrenVersionRef.current.set(activeKey, version);

    const settleTimer = window.setTimeout(() => {
      const latestVersion = childrenVersionRef.current.get(activeKey);
      if (latestVersion !== version) return;
      // lazy：fallback → 真实页至少 2 次 children 更新后才写入，避免固化 Spin
      if (latestVersion < 2) return;

      const node = childrenRef.current;
      if (!node) return;
      const token = refreshByKeyRef.current.get(activeKey) ?? 0;
      setCache((prev) => {
        const next = new Map(prev);
        next.set(activeKey, { node, refreshToken: token });
        return next;
      });
    }, SETTLE_MS);

    return () => clearTimeout(settleTimer);
  }, [activeKey, children]);

  useLayoutEffect(() => {
    const openSet = new Set(createTabKeys);
    setCache((prev) => {
      let changed = false;
      const next = new Map<string, CacheEntry>();
      for (const [key, entry] of prev.entries()) {
        if (openSet.has(key)) {
          next.set(key, entry);
        } else {
          refreshByKeyRef.current.delete(key);
          visitedCreateTabKeysRef.current.delete(key);
          childrenVersionRef.current.delete(key);
          changed = true;
        }
      }
      if (!changed && next.size === prev.size) {
        return prev;
      }
      return next;
    });
  }, [createTabKeys]);

  useLayoutEffect(() => {
    if (!activeKey) return;

    const departingKey = prevActiveKeyRef.current;
    const lastRefresh = refreshByKeyRef.current.get(activeKey);
    const forceReplace = lastRefresh !== undefined && lastRefresh !== refreshToken;

    if (forceReplace && isCreateTabKey(activeKey)) {
      visitedCreateTabKeysRef.current.delete(activeKey);
      childrenVersionRef.current.delete(activeKey);
      setCache((prev) => {
        if (!prev.has(activeKey)) return prev;
        const next = new Map(prev);
        next.delete(activeKey);
        return next;
      });
    }

    if (
      departingKey &&
      departingKey !== activeKey &&
      isCreateTabKey(departingKey)
    ) {
      visitedCreateTabKeysRef.current.add(departingKey);
    }

    refreshByKeyRef.current.set(activeKey, refreshToken);
    prevActiveKeyRef.current = activeKey;
  }, [activeKey, refreshToken]);

  const paneKeys = useMemo(() => new Set(createTabKeys), [createTabKeys]);

  return (
    <>
      {Array.from(paneKeys).map((key) => {
        const isActive = key === activeKey;
        const cached = cache.get(key);
        const canRestoreFromCache =
          isActive &&
          visitedCreateTabKeysRef.current.has(key) &&
          cached?.node;

        let content: React.ReactNode | null = null;
        if (canRestoreFromCache) {
          content = cached!.node;
        } else if (isActive && isActiveCreate) {
          content = children;
        } else if (!isActive && cached?.node) {
          content = cached.node;
        }

        if (!content) {
          return null;
        }

        const useLocationScope = canRestoreFromCache || !isActive;

        const body = useLocationScope
          ? <TabRouteLocationScope tabKey={key}>{content}</TabRouteLocationScope>
          : content;

        return (
          <div
            key={key}
            className={`uni-tabs-route-cache-pane${isActive ? ' uni-tabs-route-cache-pane--active' : ''}`}
            style={{
              ...routePaneStyle,
              display: isActive ? 'flex' : 'none',
            }}
            aria-hidden={!isActive}
          >
            <div className="riveredge-route-transition" style={routeTransitionStyle}>
              {isActive && isActiveCreate && !canRestoreFromCache
                ? <RouteTransition>{body}</RouteTransition>
                : body}
            </div>
          </div>
        );
      })}

      {!isActiveCreate && (
        <div className="uni-tabs-route-cache-pane uni-tabs-route-cache-pane--active" style={routePaneStyle}>
          <RouteTransition>{children}</RouteTransition>
        </div>
      )}
    </>
  );
}
