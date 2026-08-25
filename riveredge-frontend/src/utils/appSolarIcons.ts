/**
 * 应用中心卡片 Solar 图标解析（manifest.icon 别名 → solar:xxx-bold-duotone）
 */
import { addCollection } from '@iconify/react/dist/offline';
import solarIcons from '@iconify-json/solar/icons.json';

addCollection(solarIcons);

/** 应用 code → Solar 图标（应用根 / 行业包一级菜单） */
export const APP_SOLAR_ICONS: Record<string, string> = {
  kuaizhizao: 'solar:buildings-2-bold-duotone',
  kuaicaiwu: 'solar:wallet-money-bold-duotone',
  kuaireport: 'solar:chart-2-bold-duotone',
  'master-data': 'solar:database-bold-duotone',
  kuaiai: 'solar:magic-stick-3-bold-duotone',
  kuaiiot: 'solar:cpu-bolt-bold-duotone',
  kuaiplm: 'solar:layers-bold-duotone',
  kuaioa: 'solar:document-text-bold-duotone',
  kuaicrm: 'solar:hand-shake-bold-duotone',
  kuaitms: 'solar:delivery-bold-duotone',
  kuaiasms: 'solar:headphones-round-bold-duotone',
  kuailtms: 'solar:test-tube-bold-duotone',
  kuaiip: 'solar:shield-check-bold-duotone',
  haoligo: 'solar:smartphone-bold-duotone',
  'spoke-wheel': 'solar:wheel-bold-duotone',
  'industry-pack': 'solar:layers-bold-duotone',
  bi: 'solar:pie-chart-bold-duotone',
  crm: 'solar:hand-shake-bold-duotone',
  erp: 'solar:cart-large-2-bold-duotone',
  mes: 'solar:settings-bold-duotone',
  wms: 'solar:box-bold-duotone',
  oa: 'solar:document-text-bold-duotone',
  scm: 'solar:structure-bold-duotone',
  hr: 'solar:users-group-rounded-bold-duotone',
};

/** manifest.icon（Lucide/旧别名）→ Solar */
export const MANIFEST_ICON_TO_SOLAR: Record<string, string> = {
  production: 'solar:buildings-2-bold-duotone',
  factory: 'solar:buildings-2-bold-duotone',
  calculator: 'solar:calculator-bold-duotone',
  fileBarChart: 'solar:chart-2-bold-duotone',
  'bar-chart': 'solar:chart-bold-duotone',
  database: 'solar:database-bold-duotone',
  sparkles: 'solar:magic-stick-3-bold-duotone',
  cpu: 'solar:cpu-bolt-bold-duotone',
  layers: 'solar:layers-bold-duotone',
  shop: 'solar:shop-2-bold-duotone',
  warehouse: 'solar:box-bold-duotone',
  smartphone: 'solar:smartphone-bold-duotone',
  thunderbolt: 'solar:bolt-bold-duotone',
  bolt: 'solar:bolt-bold-duotone',
  widget: 'solar:widget-bold-duotone',
  appstore: 'solar:widget-5-bold-duotone',
  wheel: 'solar:wheel-bold-duotone',
  aim: 'solar:target-bold-duotone',
  tool: 'solar:settings-bold-duotone',
};

export function resolveAppSolarIcon(
  icon?: string | null,
  appCode?: string | null,
): string | undefined {
  const trimmed = String(icon || '').trim();
  if (trimmed.startsWith('solar:')) return trimmed;
  if (trimmed && MANIFEST_ICON_TO_SOLAR[trimmed]) {
    return MANIFEST_ICON_TO_SOLAR[trimmed];
  }
  const code = String(appCode || '').trim();
  if (code && APP_SOLAR_ICONS[code]) {
    return APP_SOLAR_ICONS[code];
  }
  return undefined;
}
