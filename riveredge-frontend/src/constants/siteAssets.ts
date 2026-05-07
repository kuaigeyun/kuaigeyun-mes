/**
 * 框架默认 PNG Logo：`static/img/logo.png`（Vite `publicDir` = `static/`）→ `/img/logo.png`
 */
export const DEFAULT_SITE_LOGO_URL = '/img/logo.png';

/**
 * 次级静态兜底：`static/favicon.svg`（与 index.html 标签图标一致，体积更小）
 */
export const SITE_LOGO_FALLBACK_SVG_URL = '/favicon.svg';

/** PNG/SVG 均不可用时：极小内置 SVG（data URI，不依赖静态资源部署） */
const FRAMEWORK_LOGO_SVG_MARKUP = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#1890ff"/><text x="16" y="21" font-size="14" font-weight="bold" fill="#ffffff" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif">R</text></svg>`;

export const EMBEDDED_FRAMEWORK_LOGO_DATA_URI =
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(FRAMEWORK_LOGO_SVG_MARKUP)}`;

/**
 * `<img>` 加载失败时的 URL 递进：自定义 / 预览地址 → `/img/logo.png` → `/favicon.svg` → 内置 data URI。
 */
export function nextSiteLogoUrlAfterImageError(currentUrl: string): string {
  if (currentUrl !== DEFAULT_SITE_LOGO_URL) {
    return DEFAULT_SITE_LOGO_URL;
  }
  if (currentUrl !== SITE_LOGO_FALLBACK_SVG_URL) {
    return SITE_LOGO_FALLBACK_SVG_URL;
  }
  if (currentUrl !== EMBEDDED_FRAMEWORK_LOGO_DATA_URI) {
    return EMBEDDED_FRAMEWORK_LOGO_DATA_URI;
  }
  return currentUrl;
}
