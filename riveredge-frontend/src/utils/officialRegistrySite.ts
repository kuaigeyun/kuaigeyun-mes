/** 官方 SaaS 注册中心站点（构建来源汇总仅在此域名展示） */

const OFFICIAL_REGISTRY_HOSTS = new Set(['kuaigeyun.com', 'www.kuaigeyun.com']);

export function isOfficialRegistrySite(): boolean {
  if (typeof window === 'undefined') return false;
  return OFFICIAL_REGISTRY_HOSTS.has(window.location.hostname.toLowerCase());
}

export function canShowRegistrySummaryAdmin(registrySummaryAdminAvailable?: boolean): boolean {
  return isOfficialRegistrySite() && registrySummaryAdminAvailable === true;
}
