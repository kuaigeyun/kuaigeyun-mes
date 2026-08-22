/** 侧栏菜单行间距：标准（antd 默认档） / 紧凑 */
export type SidebarMenuDensity = 'standard' | 'compact';

export const SIDEBAR_MENU_DENSITY_PREF_KEY = 'ui.sidebar_menu_density';

export const DEFAULT_SIDEBAR_MENU_DENSITY: SidebarMenuDensity = 'standard';

export function readSidebarMenuDensityPref(
  preferences: Record<string, unknown> | null | undefined,
): SidebarMenuDensity {
  const nested = preferences?.ui as Record<string, unknown> | undefined;
  const raw = nested?.sidebar_menu_density ?? preferences?.[SIDEBAR_MENU_DENSITY_PREF_KEY];
  return raw === 'compact' ? 'compact' : DEFAULT_SIDEBAR_MENU_DENSITY;
}
