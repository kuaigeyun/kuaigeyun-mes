/**
 * 内置中国行政区（省 / 市 / 区县，含港澳台），供站点「用户位置」手工选择。
 * 大陆数据源自 element-china-area-data regionData 快照；港澳台为内置补齐。
 */
import regionData from './chinaAdminRegions.json';

export type ChinaAdminRegionOption = {
  value: string;
  label: string;
  children?: ChinaAdminRegionOption[];
};

export const CHINA_ADMIN_REGION_OPTIONS = regionData as ChinaAdminRegionOption[];

/** 按 codes 解析行政区中文名路径 */
export function resolveChinaAdminRegionLabels(codes: string[] | null | undefined): string[] {
  if (!codes?.length) return [];
  const labels: string[] = [];
  let level: ChinaAdminRegionOption[] | undefined = CHINA_ADMIN_REGION_OPTIONS;
  for (const code of codes) {
    const hit = level?.find((n) => n.value === String(code));
    if (!hit) break;
    labels.push(hit.label);
    level = hit.children;
  }
  return labels;
}

/**
 * 天气查询用城市名：优先末级区县；若为「市辖区」则回退上级市名。
 */
export function resolveWeatherCityLabel(labels: string[] | null | undefined): string | null {
  if (!labels?.length) return null;
  const filtered = labels.filter((x) => x && x !== '市辖区' && x !== '县');
  if (!filtered.length) return labels[labels.length - 1] || null;
  return filtered[filtered.length - 1] || null;
}
