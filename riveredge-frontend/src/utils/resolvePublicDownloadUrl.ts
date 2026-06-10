const LOOPBACK = /^(localhost|127\.0\.0\.1|::1)$/i;

const PUBLIC_HOST_KEYS = ['client_download_public_host', 'mobile_debug_ip'] as const;

export function isPageLoopback(): boolean {
  return LOOPBACK.test(window.location.hostname);
}

/** 扫码下载用：优先局域网/外网 host，避免 QR 指向 127.0.0.1 */
export function readPublicDownloadHost(): string | null {
  for (const key of PUBLIC_HOST_KEYS) {
    const value = localStorage.getItem(key)?.trim();
    if (value && !LOOPBACK.test(value)) {
      return value;
    }
  }
  const pageHost = window.location.hostname;
  if (pageHost && !LOOPBACK.test(pageHost)) {
    return pageHost;
  }
  return null;
}

function pathFromRawUrl(rawUrl: string): string {
  if (/^https?:\/\//i.test(rawUrl)) {
    const u = new URL(rawUrl);
    return `${u.pathname}${u.search}`;
  }
  return rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
}

/**
 * 将 API 返回的安装包 URL 转为手机可访问的绝对地址。
 * @param originOverride 后端解析的 LAN origin（如 http://192.168.1.5:8200），优先于页面 origin
 */
export function resolvePublicDownloadUrl(rawUrl: string, originOverride?: string | null): string {
  const page = window.location;
  const path = pathFromRawUrl(rawUrl);

  if (originOverride) {
    const base = originOverride.endsWith('/') ? originOverride : `${originOverride}/`;
    return new URL(path, base).toString();
  }

  const publicHost = readPublicDownloadHost();
  const url = /^https?:\/\//i.test(rawUrl)
    ? new URL(rawUrl)
    : new URL(path, page.origin);

  if (publicHost && LOOPBACK.test(url.hostname)) {
    url.hostname = publicHost;
  }

  if (url.pathname.startsWith('/static/client-') && page.port && !LOOPBACK.test(url.hostname)) {
    url.port = page.port;
  }

  return url.toString();
}

export function isLoopbackDownloadUrl(url: string): boolean {
  try {
    const u = new URL(url.startsWith('/') ? `http://local${url}` : url);
    return LOOPBACK.test(u.hostname);
  } catch {
    return false;
  }
}
