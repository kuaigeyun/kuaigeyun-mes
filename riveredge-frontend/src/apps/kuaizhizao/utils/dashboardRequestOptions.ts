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

