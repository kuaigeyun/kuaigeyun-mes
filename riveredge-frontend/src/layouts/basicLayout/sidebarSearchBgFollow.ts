/** 侧栏菜单搜索条背景跟随：标签栏 / 菜单栏 */
export type SidebarSearchBgFollow = 'tabs' | 'sider';

export const SIDEBAR_SEARCH_BG_FOLLOW_PREF_KEY = 'ui.sidebar_search_bg_follow';

export const DEFAULT_SIDEBAR_SEARCH_BG_FOLLOW: SidebarSearchBgFollow = 'sider';

export function readSidebarSearchBgFollowPref(
  preferences: Record<string, unknown> | null | undefined,
): SidebarSearchBgFollow {
  const nested = preferences?.ui as Record<string, unknown> | undefined;
  const raw = nested?.sidebar_search_bg_follow ?? preferences?.[SIDEBAR_SEARCH_BG_FOLLOW_PREF_KEY];
  return raw === 'tabs' ? 'tabs' : DEFAULT_SIDEBAR_SEARCH_BG_FOLLOW;
}
