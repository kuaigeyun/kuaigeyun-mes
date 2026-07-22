/**
 * 非桌面宽度由 Expo H5 接管：PC / H5 二分，无中间平板布局档。
 *
 * - 宽度 < 1200 → H5（与历史工作台 MobileWorkplace 阈值对齐，避免 1024–1199 假平板）
 * - 宽度 ≥ 1200 → PC
 * - 生产：同域 /mobile/
 * - 开发：独立端口根路径（默认 http://host:8081/）
 * - 逃生：?desktop=1 → 本会话留在 PC
 */

/** 与 H5 redirectToDesktopIfWide.DESKTOP_MIN_WIDTH_PX 对齐 */
export const H5_MAX_WIDTH_PX = 1199;
const PREFER_DESKTOP_KEY = 'riveredge_prefer_pc';
/** 与 fast-deploy/launch.dev.sh MOBILE_PORT 对齐 */
const DEFAULT_MOBILE_DEV_PORT = '8081';
const PC_DEV_PORTS = new Set(['8100', '5173']);

function mobileDevPort(): string {
  const fromEnv = import.meta.env.VITE_MOBILE_DEV_PORT;
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim();
  return DEFAULT_MOBILE_DEV_PORT;
}

function isDevPcHost(): boolean {
  if (typeof window === 'undefined') return false;
  return import.meta.env.DEV || PC_DEV_PORTS.has(window.location.port);
}

/** 生产同域 /mobile/；开发 → http(s)://host:8081/ */
export function resolveMobileEntryUrl(): string {
  if (typeof window === 'undefined') return '/mobile/';
  const { protocol, hostname } = window.location;
  const explicit = import.meta.env.VITE_MOBILE_DEV_URL;
  if (typeof explicit === 'string' && explicit.trim()) {
    const base = explicit.trim().replace(/\/$/, '');
    return `${base}/`;
  }
  if (isDevPcHost()) {
    return `${protocol}//${hostname}:${mobileDevPort()}/`;
  }
  return '/mobile/';
}

function prefersDesktopThisSession(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get('desktop') === '1') {
      sessionStorage.setItem(PREFER_DESKTOP_KEY, '1');
      return true;
    }
    return sessionStorage.getItem(PREFER_DESKTOP_KEY) === '1';
  } catch {
    return false;
  }
}

function isAlreadyOnMobile(): boolean {
  const { port, pathname, hostname } = window.location;
  if (port === DEFAULT_MOBILE_DEV_PORT || port === '19006') return true;
  if (pathname === '/mobile' || pathname.startsWith('/mobile/')) return true;
  if (
    (hostname === 'localhost' || hostname === '127.0.0.1') &&
    port === mobileDevPort()
  ) {
    return true;
  }
  return false;
}

function isH5Viewport(): boolean {
  return window.matchMedia(`(max-width: ${H5_MAX_WIDTH_PX}px)`).matches;
}

function goMobile(): void {
  window.location.replace(resolveMobileEntryUrl());
}

/**
 * 非桌面宽度则跳转 H5。
 * @returns true 表示已发起跳转，调用方应停止后续挂载
 */
export function redirectToMobileIfNarrow(): boolean {
  if (typeof window === 'undefined') return false;
  if (isAlreadyOnMobile() || prefersDesktopThisSession()) return false;

  if (isH5Viewport()) {
    goMobile();
    return true;
  }

  const mql = window.matchMedia(`(max-width: ${H5_MAX_WIDTH_PX}px)`);
  const onChange = () => {
    if (!isH5Viewport() || prefersDesktopThisSession() || isAlreadyOnMobile()) return;
    goMobile();
  };
  mql.addEventListener('change', onChange);
  window.addEventListener('resize', onChange);
  return false;
}
