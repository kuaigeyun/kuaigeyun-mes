import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { NavigationType, UNSAFE_LocationContext as LocationContext } from 'react-router-dom';
import type { Location } from 'react-router-dom';
import { RouteTransition } from '../route-transition';
import { isCreateTabKey } from './isCreateTabKey';

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

/** 表单页使用冻结 location，避免 list/new/edit 共用组件因全局路由变化卸载表单。 */
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
 * 单个表单标签保活 pane：首次激活后持续挂载，仅用 display 切换显隐，不替换子树。
 */
function FormTabKeepAlivePane({
  tabKey,
  active,
  visited,
  resetSignal,
  liveChildren,
}: {
  tabKey: string;
  active: boolean;
  visited: boolean;
  resetSignal: number;
  liveChildren: React.ReactNode;
}) {
  const hasMountedRef = useRef(false);
  const frozenTreeRef = useRef<React.ReactNode>(null);
  const resetSeenRef = useRef(resetSignal);

  if (resetSeenRef.current !== resetSignal) {
    resetSeenRef.current = resetSignal;
    hasMountedRef.current = false;
    frozenTreeRef.current = null;
  }

  if (active) {
    hasMountedRef.current = true;
  }

  if (active && !visited) {
    frozenTreeRef.current = liveChildren;
  }

  if (!hasMountedRef.current || frozenTreeRef.current == null) {
    return null;
  }

  return (
    <div
      className={`uni-tabs-route-cache-pane${active ? ' uni-tabs-route-cache-pane--active' : ''}`}
      style={{
        ...routePaneStyle,
        display: active ? 'flex' : 'none',
      }}
      aria-hidden={!active}
    >
      <div className="riveredge-route-transition" style={routeTransitionStyle}>
        <TabRouteLocationScope tabKey={tabKey}>{frozenTreeRef.current}</TabRouteLocationScope>
      </div>
    </div>
  );
}

/**
 * UniTabs 上新建/编辑表单标签的唯一 keep-alive 来源（/new、/create、/:id/edit）。
 * 普通列表标签由 RouteTransition 直接渲染，不参与缓存。
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
  const refreshByKeyRef = useRef<Map<string, number>>(new Map());
  const prevActiveKeyRef = useRef(activeKey);
  const visitedCreateTabKeysRef = useRef<Set<string>>(new Set());
  const paneResetSignalRef = useRef<Map<string, number>>(new Map());

  const isActiveCreate = isCreateTabKey(activeKey);

  const prevKey = prevActiveKeyRef.current;
  if (prevKey !== activeKey && isCreateTabKey(prevKey)) {
    visitedCreateTabKeysRef.current.add(prevKey);
  }

  useLayoutEffect(() => {
    const openSet = new Set(createTabKeys);
    for (const key of visitedCreateTabKeysRef.current) {
      if (!openSet.has(key)) {
        visitedCreateTabKeysRef.current.delete(key);
        refreshByKeyRef.current.delete(key);
        paneResetSignalRef.current.delete(key);
      }
    }
  }, [createTabKeys]);

  useLayoutEffect(() => {
    if (!activeKey) return;

    const lastRefresh = refreshByKeyRef.current.get(activeKey);
    const forceReplace = lastRefresh !== undefined && lastRefresh !== refreshToken;

    if (forceReplace && isCreateTabKey(activeKey)) {
      visitedCreateTabKeysRef.current.delete(activeKey);
      paneResetSignalRef.current.set(
        activeKey,
        (paneResetSignalRef.current.get(activeKey) ?? 0) + 1,
      );
    }

    refreshByKeyRef.current.set(activeKey, refreshToken);
    prevActiveKeyRef.current = activeKey;
  }, [activeKey, refreshToken]);

  const paneKeys = useMemo(() => new Set(createTabKeys), [createTabKeys]);

  return (
    <>
      {Array.from(paneKeys).map((key) => (
        <FormTabKeepAlivePane
          key={key}
          tabKey={key}
          active={key === activeKey}
          visited={visitedCreateTabKeysRef.current.has(key)}
          resetSignal={paneResetSignalRef.current.get(key) ?? 0}
          liveChildren={children}
        />
      ))}

      {!isActiveCreate && (
        <div className="uni-tabs-route-cache-pane uni-tabs-route-cache-pane--active" style={routePaneStyle}>
          <RouteTransition>{children}</RouteTransition>
        </div>
      )}
    </>
  );
}
