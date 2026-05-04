/**
 * 财务管理（快财务 kuaicaiwu）
 *
 * 应收应付、发票等台账在快制造侧已下线，请从快财务打开对应页面。
 * 部署时可通过 `VITE_KUAICAIWU_BASE_URL` 或运行前 `window.__KUAICAIWU_BASE__` 指定快财务根路径。
 *
 * @author RiverEdge Team
 * @date 2025-12-29
 */

/** 快财务应用根路径（无尾部斜杠） */
export function getKuaicaiwuBaseUrl(): string {
  if (typeof window !== 'undefined' && (window as unknown as { __KUAICAIWU_BASE__?: string }).__KUAICAIWU_BASE__) {
    return String((window as unknown as { __KUAICAIWU_BASE__: string }).__KUAICAIWU_BASE__).replace(/\/$/, '');
  }
  try {
    const env = (import.meta as { env?: { VITE_KUAICAIWU_BASE_URL?: string } }).env?.VITE_KUAICAIWU_BASE_URL;
    if (env && String(env).trim()) return String(env).trim().replace(/\/$/, '');
  } catch {
    /* import.meta 不可用时忽略 */
  }
  return '/apps/kuaicaiwu';
}

/** 在新窗口打开快财务路径（path 须以 / 开头） */
export function openKuaicaiwu(path = '/finance'): void {
  const base = getKuaicaiwuBaseUrl();
  const p = path.startsWith('/') ? path : `/${path}`;
  window.open(`${base}${p}`, '_blank', 'noopener,noreferrer');
}
