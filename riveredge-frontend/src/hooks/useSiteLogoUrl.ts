import { useState, useEffect } from 'react';
import { useConfigStore } from '../stores/configStore';
import { getSiteLogoPreview, isSiteLogoUuidKnownMissing } from '../services/file';
import { toRelativeIfLocalhost } from '../utils/avatar';
import { DEFAULT_SITE_LOGO_URL, SITE_LOGO_FALLBACK_SVG_URL } from '../constants/siteAssets';

const SITE_LOGO_CACHE_TTL_MS = 25 * 60 * 1000;

function getCachedSiteLogoUrl(logoUuid: string): string | undefined {
  try {
    const raw = localStorage.getItem(`siteLogoUrlCache_${logoUuid}`);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    const { url, ts } = typeof parsed === 'object' ? parsed : { url: raw, ts: 0 };
    if (!url || typeof url !== 'string') return undefined;
    if (typeof ts === 'number' && Date.now() - ts > SITE_LOGO_CACHE_TTL_MS) return undefined;
    return toRelativeIfLocalhost(url);
  } catch {
    return undefined;
  }
}

function setCachedSiteLogoUrl(logoUuid: string, url: string): void {
  try {
    localStorage.setItem(`siteLogoUrlCache_${logoUuid}`, JSON.stringify({ url, ts: Date.now() }));
  } catch {
    /* ignore */
  }
}

function clearCachedSiteLogoUrl(logoUuid: string): void {
  try {
    localStorage.removeItem(`siteLogoUrlCache_${logoUuid}`);
  } catch {
    /* ignore */
  }
}

function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/** 与顶栏一致的站点 Logo 解析（UUID / URL / 默认图） */
export function useSiteLogoUrl(): string {
  const siteLogoValue = (useConfigStore((s) => (s.getConfig('site_logo', '') as string)?.trim()) || '') || '';

  const [siteLogoUrl, setSiteLogoUrl] = useState<string>(() => {
    const logoValue = (useConfigStore.getState().getConfig('site_logo', '') as string)?.trim() || '';
    if (logoValue) {
      if (isUUID(logoValue)) {
        if (isSiteLogoUuidKnownMissing(logoValue)) {
          return DEFAULT_SITE_LOGO_URL;
        }
        return SITE_LOGO_FALLBACK_SVG_URL;
      } else {
        return logoValue;
      }
    }
    return DEFAULT_SITE_LOGO_URL;
  });

  useEffect(() => {
    const loadSiteLogo = async () => {
      if (!siteLogoValue) {
        setSiteLogoUrl(DEFAULT_SITE_LOGO_URL);
        return;
      }
      if (isUUID(siteLogoValue)) {
        if (isSiteLogoUuidKnownMissing(siteLogoValue)) {
          clearCachedSiteLogoUrl(siteLogoValue);
          setSiteLogoUrl(DEFAULT_SITE_LOGO_URL);
          return;
        }
        const previewInfo = await getSiteLogoPreview(siteLogoValue, { forAvatar: true });
        if (!previewInfo?.preview_url) {
          clearCachedSiteLogoUrl(siteLogoValue);
          setSiteLogoUrl(DEFAULT_SITE_LOGO_URL);
          return;
        }
        const newUrl = toRelativeIfLocalhost(previewInfo.preview_url);
        setSiteLogoUrl(newUrl);
        setCachedSiteLogoUrl(siteLogoValue, newUrl);
      } else {
        setSiteLogoUrl(siteLogoValue);
      }
    };
    loadSiteLogo();
  }, [siteLogoValue]);

  return siteLogoUrl;
}
