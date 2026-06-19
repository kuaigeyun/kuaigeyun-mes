/**
 * Favicon 工具函数
 *
 * 从平台设置应用 Favicon 到 document head；自定义地址不可用或与 PNG/SVG 静态资源均失败时递进兜底。
 */

import {
  DEFAULT_SITE_LOGO_URL,
  EMBEDDED_FRAMEWORK_LOGO_DATA_URI,
  SITE_LOGO_FALLBACK_SVG_URL,
} from '../constants/siteAssets';
import { toRelativeIfLocalhost } from './avatar';

const ICON_PROBE_MS = 8000;

/** 与后端 public branding 别名一致：favicon 配置常指向 platform-logo 文件 */
const PLATFORM_FAVICON_PUBLIC_CATEGORIES = ['platform-favicon', 'platform-logo'] as const;

async function fetchPlatformFaviconPublicPreviewUrl(uuid: string): Promise<string | undefined> {
  for (const category of PLATFORM_FAVICON_PUBLIC_CATEGORIES) {
    try {
      const res = await fetch(
        `/api/v1/core/files/${uuid}/preview/public?category=${encodeURIComponent(category)}`,
      );
      if (!res.ok) continue;
      const data = (await res.json()) as { preview_url?: string };
      const previewUrl = data?.preview_url?.trim();
      if (previewUrl) {
        return toRelativeIfLocalhost(previewUrl);
      }
    } catch {
      // try next category
    }
  }
  return undefined;
}

function setIconLinkHref(href: string): void {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = href;
  if (href.startsWith('data:')) {
    link.type = 'image/svg+xml';
  } else if (href.endsWith('.svg')) {
    link.type = 'image/svg+xml';
  } else if (href.endsWith('.png')) {
    link.type = 'image/png';
  } else {
    link.removeAttribute('type');
  }
}

function probeImageLoads(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    const finish = (ok: boolean) => {
      window.clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      resolve(ok);
    };
    const timer = window.setTimeout(() => finish(false), ICON_PROBE_MS);
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    img.src = url;
  });
}

/** 按顺序探测可用图片 URL，首个可加载的设为 tab icon */
async function applyFaviconHrefWithFallback(primaryHref: string | undefined): Promise<void> {
  const chain = [
    primaryHref,
    DEFAULT_SITE_LOGO_URL,
    SITE_LOGO_FALLBACK_SVG_URL,
    EMBEDDED_FRAMEWORK_LOGO_DATA_URI,
  ].filter((u): u is string => typeof u === 'string' && u.trim().length > 0);

  const seen = new Set<string>();
  const unique = chain.filter((u) => (seen.has(u) ? false : (seen.add(u), true)));

  for (const href of unique) {
    if (await probeImageLoads(href)) {
      setIconLinkHref(href);
      return;
    }
  }
  setIconLinkHref(unique[unique.length - 1] ?? DEFAULT_SITE_LOGO_URL);
}

/**
 * 应用 Favicon 到页面
 * @param faviconValue - Favicon 值（UUID 或 URL）；空则仅用框架兜底链（优先 `/img/logo.png`）
 */
export async function applyFavicon(faviconValue: string | undefined): Promise<void> {
  if (typeof document === 'undefined') return;

  if (!faviconValue?.trim()) {
    await applyFaviconHrefWithFallback(undefined);
    return;
  }

  const value = faviconValue.trim();
  const isUUID = (str: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

  if (isUUID(value)) {
    const failedKey = `RIVEREDGE_FAVICON_FAILED_V2_${value}`;
    if (typeof window !== 'undefined' && window.sessionStorage.getItem(failedKey) === '1') {
      await applyFaviconHrefWithFallback(undefined);
      return;
    }
    try {
      const previewUrl = await fetchPlatformFaviconPublicPreviewUrl(value);
      if (!previewUrl) {
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(failedKey, '1');
        }
        await applyFaviconHrefWithFallback(undefined);
        return;
      }
      await applyFaviconHrefWithFallback(previewUrl);
    } catch {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(failedKey, '1');
      }
      await applyFaviconHrefWithFallback(undefined);
    }
    return;
  }

  await applyFaviconHrefWithFallback(toRelativeIfLocalhost(value));
}
