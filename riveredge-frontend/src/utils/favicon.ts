/**
 * Favicon 工具函数
 *
 * 从平台设置应用 Favicon 到 document head
 */

/**
 * 应用 Favicon 到页面
 * @param faviconValue - Favicon 值（UUID 或 URL）
 */
export async function applyFavicon(faviconValue: string | undefined): Promise<void> {
  if (!faviconValue?.trim()) return;

  const value = faviconValue.trim();
  const isUUID = (str: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

  let href: string;

  if (isUUID(value)) {
    try {
      const baseUrl = import.meta.env.VITE_BACKEND_URL || '';
      const res = await fetch(
        `${baseUrl}/api/v1/core/files/${value}/preview/public?category=platform-favicon`
      );
      if (!res.ok) return;
      const { preview_url } = await res.json();
      href = preview_url;
    } catch {
      return;
    }
  } else {
    href = value;
  }

  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = href;
}
