import React, { useLayoutEffect, useRef, useState } from 'react';

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

/**
 * 多标签页路由缓存：已打开的标签切换时不卸载页面，避免新建/编辑表单数据丢失。
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

  const activeEntry = cache.get(activeKey);
  const nodesToRender =
    cache.size === 0
      ? [[activeKey, { node: children, refreshToken }] as const]
      : Array.from(cache.entries());

  return (
    <>
      {nodesToRender.map(([key, entry]) => {
        const isActive = key === activeKey;
        const node = isActive && activeEntry ? activeEntry.node : entry.node;
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
              {node}
            </div>
          </div>
        );
      })}
    </>
  );
}
