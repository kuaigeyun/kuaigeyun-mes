import type { Application } from '../services/application';

/** 快连接（原数据中心四页）专业应用 code */
export const KUAICONNECT_APP_CODE = 'kuaiconnect';

/** 系统设置浮层 / 侧栏「数据中心」四入口（依赖快连接启用） */
export const DATA_CENTER_SYSTEM_PATHS: readonly string[] = [
  '/system/application-connections',
  '/system/apis',
  '/system/data-sources',
  '/system/datasets',
];

export function isDataCenterSystemPath(path?: string | null): boolean {
  const normalized = String(path || '').trim();
  if (!normalized) return false;
  return DATA_CENTER_SYSTEM_PATHS.some(
    (p) => normalized === p || normalized.startsWith(`${p}/`),
  );
}

/** 已安装、已启用且 PRO 授权通过（若适用） */
export function isKuaiconnectReady(installedApps: Application[] | undefined): boolean {
  const app = installedApps?.find((row) => row.code === KUAICONNECT_APP_CODE);
  if (!app?.is_installed || !app.is_active) return false;
  if (app.is_pro && app.can_access === false) return false;
  return true;
}
