import { useEffect, useMemo, useRef } from 'react';
import { useRequest } from 'ahooks';
import { getCache, setCache } from 'ahooks/es/useRequest/src/utils/cache';

export const DASHBOARD_REQUEST_STALE_TIME = 60_000;
export const DASHBOARD_REQUEST_CACHE_TIME = 30 * 60_000;

export function dashboardRequestOptions(
  cacheKey: string,
  extra: Record<string, unknown> = {},
) {
  return {
    cacheKey,
    staleTime: DASHBOARD_REQUEST_STALE_TIME,
    cacheTime: DASHBOARD_REQUEST_CACHE_TIME,
    ...extra,
  };
}

function readFreshDashboardCache<TData>(cacheKey: string): TData | undefined {
  const cached = getCache(cacheKey);
  if (!cached || !Object.prototype.hasOwnProperty.call(cached, 'data')) {
    return undefined;
  }
  if (
    DASHBOARD_REQUEST_STALE_TIME !== -1 &&
    Date.now() - cached.time > DASHBOARD_REQUEST_STALE_TIME
  ) {
    return undefined;
  }
  return cached.data as TData;
}

function readDashboardCacheEntry(cacheKey: string) {
  return getCache(cacheKey);
}

function writeDashboardCache<TData, TParams extends unknown[]>(
  cacheKey: string,
  data: TData,
  params: TParams,
) {
  setCache(cacheKey, DASHBOARD_REQUEST_CACHE_TIME, {
    data,
    params,
    time: Date.now(),
  });
}

/**
 * 看板数据请求：挂载后再 run；缓存写入 ahooks 全局 cache，但不传 cacheKey 给 useRequest，
 * 避免 cache 插件在首屏 render 阶段 subscribe 并 setState。
 */
export function useDashboardRequest<TData, TParams extends unknown[]>(
  service: (...args: TParams) => Promise<TData>,
  cacheKey: string,
  extra: Record<string, unknown> = {},
) {
  const extraRef = useRef(extra);
  extraRef.current = extra;

  const cachedInitial = useMemo(() => readFreshDashboardCache<TData>(cacheKey), [cacheKey]);

  const options = useMemo(() => {
    const { onSuccess, onError, onFinally, ...restExtra } = extraRef.current;
    return {
      ...restExtra,
      manual: true,
      onSuccess: (data: TData, params: TParams) => {
        writeDashboardCache(cacheKey, data, params);
        if (typeof onSuccess === 'function') {
          (onSuccess as (data: TData, params: TParams) => void)(data, params);
        }
      },
      onError: (error: Error, params: TParams) => {
        if (typeof onError === 'function') {
          (onError as (error: Error, params: TParams) => void)(error, params);
        }
      },
      onFinally: (params: TParams, data?: TData, error?: Error) => {
        if (typeof onFinally === 'function') {
          (onFinally as (params: TParams, data?: TData, error?: Error) => void)(
            params,
            data,
            error,
          );
        }
      },
    };
  }, [cacheKey]);

  const result = useRequest(service, options);

  useEffect(() => {
    const cacheEntry = readDashboardCacheEntry(cacheKey);
    const hasData =
      !!cacheEntry && Object.prototype.hasOwnProperty.call(cacheEntry, 'data');
    const isFresh = hasData && readFreshDashboardCache(cacheKey) !== undefined;
    const pollingInterval = extraRef.current.pollingInterval as number | undefined;

    if (hasData && (!isFresh || pollingInterval)) {
      result.mutate(cacheEntry.data as TData);
    }

    if (!isFresh || pollingInterval) {
      result.run();
    }

    return () => {
      result.cancel();
    };
  }, [cacheKey, result.cancel, result.mutate, result.run]);

  const data = result.data !== undefined ? result.data : cachedInitial;

  return {
    ...result,
    data,
    loading: result.loading && data === undefined,
  };
}
