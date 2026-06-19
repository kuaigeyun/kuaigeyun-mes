/** 新建类标签：pathname 以 /new 或 /create 结尾（不含 query）。 */
export function isCreateTabKey(tabKey: string): boolean {
  const pathname = (tabKey.split('?')[0] || '/').replace(/\/$/, '') || '/';
  return pathname.endsWith('/new') || pathname.endsWith('/create');
}
