import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { NavigationType, UNSAFE_LocationContext as LocationContext } from 'react-router-dom';
import type { Location } from 'react-router-dom';

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

/** 将 UniTabs 的 tabKey（pathname + 可选 query）解析为独立 Location，供缓存页使用。 */
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

/**
 * 为每个缓存 Tab 提供「冻结」的路由位置。
 * 否则切到其他 Tab 时全局 location 变化，同一页面组件（如报价 list+new 共用）会误判路由而卸载表单。
 */
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
 * 多标签页路由缓存（Keep-Alive）：已打开的标签切换时不卸载页面，避免新建/编辑表单（含 Form.List 明细）丢失。
 * React 无 Vue keep-alive；通过 display:none 保活 + 每 Tab 独立 Location 上下文实现。
 * 标签关闭时从缓存移除；右键刷新时仅替换当前标签的缓存条目。
 */
export function TabRouteCache({
  activeKey,
  openTabKeys,
  refreshToken,
  children,
}: {
  activeKey: string;
  openTabKeys: string[];
  refreshToken: number;
  children: React.ReactNode;
}) {
  const [cache, setCache] = useState<Map<string, CacheEntry>>(() => new Map());
  const refreshByKeyRef = useRef<Map<string, number>>(new Map());

  useLayoutEffect(() => {
    if (!activeKey) return;

    setCache((prev) => {
      const openSet = new Set(openTabKeys);
      const next = new Map<string, CacheEntry>();

      for (const [key, entry] of prev.entries()) {
        if (openSet.has(key)) {
          next.set(key, entry);
        } else {
          refreshByKeyRef.current.delete(key);
        }
      }

      const lastRefresh = refreshByKeyRef.current.get(activeKey);
      const forceReplace = lastRefresh !== refreshToken;
      const hasCached = next.has(activeKey);

      if (forceReplace || !hasCached) {
        next.set(activeKey, { node: children, refreshToken });
        refreshByKeyRef.current.set(activeKey, refreshToken);
      }

      return next;
    });
  }, [activeKey, children, openTabKeys, refreshToken]);

  const nodesToRender =
    cache.size === 0
      ? [[activeKey, { node: children, refreshToken }] as const]
      : Array.from(cache.entries());

  return (
    <>
      {nodesToRender.map(([key, entry]) => {
        const isActive = key === activeKey;
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
              <TabRouteLocationScope tabKey={key}>{entry.node}</TabRouteLocationScope>
            </div>
          </div>
        );
      })}
    </>
  );
}
