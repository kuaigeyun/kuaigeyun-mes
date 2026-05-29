/** 页面级自定义标题（如详情页单号），供 UniTabs 与浏览器 document.title 共用 */

const customPageTitles = new Map<string, string>();

export function setCustomPageTitle(key: string, title: string): void {
  if (!key || !title) return;
  customPageTitles.set(key, title);
}

export function removeCustomPageTitle(key: string): void {
  customPageTitles.delete(key);
}

export function resolveCustomPageTitle(pathname: string, search: string): string | undefined {
  const fullKey = pathname + search;
  return customPageTitles.get(fullKey) ?? customPageTitles.get(pathname);
}
