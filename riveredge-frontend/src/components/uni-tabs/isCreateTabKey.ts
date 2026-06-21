/** 表单类标签 pathname：以 /new、/create 结尾，或 /{id}/edit。 */
export function isCreateTabKey(tabKey: string): boolean {
  const pathname = (tabKey.split('?')[0] || '/').replace(/\/$/, '') || '/';
  if (pathname.endsWith('/new') || pathname.endsWith('/create')) {
    return true;
  }
  return /\/[^/]+\/edit$/.test(pathname);
}
