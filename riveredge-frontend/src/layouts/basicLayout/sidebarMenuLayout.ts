import type { MenuDataItem } from '@ant-design/pro-components';
import { extractAppCodeFromPath } from '../../utils/menuTranslation';

/** 侧栏菜单布局：平铺（默认） / 双列 */
export type SidebarMenuLayout = 'flat' | 'split';

export const SIDEBAR_MENU_LAYOUT_PREF_KEY = 'ui.sidebar_menu_layout';

export const DEFAULT_SIDEBAR_MENU_LAYOUT: SidebarMenuLayout = 'flat';

/** ProLayout mix 布局默认侧栏宽度；平铺/双列共用，保证切换时总宽一致 */
export const FLAT_SIDEBAR_WIDTH = 215;
export const SPLIT_SIDEBAR_PRIMARY_WIDTH = 56;
export const SPLIT_SIDEBAR_SECONDARY_WIDTH = FLAT_SIDEBAR_WIDTH - SPLIT_SIDEBAR_PRIMARY_WIDTH;
export const SPLIT_SIDEBAR_WIDTH = FLAT_SIDEBAR_WIDTH;
export const SPLIT_SIDEBAR_COLLAPSED_WIDTH = SPLIT_SIDEBAR_PRIMARY_WIDTH;

export function readSidebarMenuLayoutPref(preferences: Record<string, unknown> | null | undefined): SidebarMenuLayout {
  const nested = preferences?.ui as Record<string, unknown> | undefined;
  const raw = nested?.sidebar_menu_layout ?? preferences?.[SIDEBAR_MENU_LAYOUT_PREF_KEY];
  return raw === 'split' ? 'split' : 'flat';
}

type SidebarShortLabelTranslate = (key: string, options?: { defaultValue?: string }) => string;

/** 双列左列短标签：优先 i18n 显式映射，避免「仪表板」被截成「表板」 */
const SIDEBAR_SHORT_LABEL_I18N_BY_PATH: Record<string, string> = {
  '/system/dashboard': 'menu.dashboard.short',
};

function resolveAppCodeForShortLabel(item: MenuDataItem): string | null {
  const path = typeof item.path === 'string' ? item.path : '';
  const fromPath = extractAppCodeFromPath(path);
  if (fromPath) return fromPath;
  if (path.startsWith('#app-group-')) {
    const code = path.slice('#app-group-'.length).trim();
    return code || null;
  }
  const key = typeof item.key === 'string' ? item.key : '';
  if (key.startsWith('app-group-code-')) {
    const code = key.slice('app-group-code-'.length).trim();
    return code || null;
  }
  return null;
}

/** 一级菜单短标签：优先 i18n（menu.*.short / app.*.short），中文兜底取末两字 */
export function toSidebarShortLabel(
  item: MenuDataItem,
  t?: SidebarShortLabelTranslate,
): string {
  const path = typeof item.path === 'string' ? item.path : '';
  const fallback = typeof item.name === 'string' ? item.name : '';

  if (t) {
    if (path) {
      const i18nKey = SIDEBAR_SHORT_LABEL_I18N_BY_PATH[path];
      if (i18nKey) {
        return t(i18nKey, { defaultValue: fallback });
      }
    }

    const appCode = resolveAppCodeForShortLabel(item);
    if (appCode) {
      const shortKey = `app.${appCode}.short`;
      const translated = t(shortKey, { defaultValue: '' });
      if (translated && translated !== shortKey && translated.trim() !== '') {
        return translated;
      }
    }
  }

  const text = fallback.trim();
  if (!text) return '';
  if (text.length <= 2) return text;
  return text.slice(-2);
}

export function menuItemKey(item: MenuDataItem): string {
  return String(item.key ?? item.path ?? item.name ?? '');
}

function treeContainsPath(items: MenuDataItem[], path: string): boolean {
  for (const item of items) {
    if (item.path === path) return true;
    if (item.children?.length && treeContainsPath(item.children, path)) return true;
  }
  return false;
}

export function findActiveRootKey(roots: MenuDataItem[], currentPath: string): string {
  for (const root of roots) {
    const key = menuItemKey(root);
    if (!key) continue;
    if (root.path === currentPath) return key;
    if (root.children?.length && treeContainsPath(root.children, currentPath)) {
      return key;
    }
  }
  const first = roots[0];
  return first ? menuItemKey(first) : '';
}

export function findFirstLeafPath(items: MenuDataItem[]): string | undefined {
  for (const item of items) {
    if (item.hideInMenu) continue;
    if (item.path && !item.path.startsWith('#')) return item.path;
    if (item.children?.length) {
      const nested = findFirstLeafPath(item.children);
      if (nested) return nested;
    }
  }
  return undefined;
}

function treeHasInfraPath(item: MenuDataItem): boolean {
  if (item.key === 'menu.infra') return true;
  if (typeof item.path === 'string' && item.path.startsWith('/infra/')) return true;
  return item.children?.some(treeHasInfraPath) ?? false;
}

/** 双列左列不展示：系统配置（走底栏）、平台基础设施等硬编码平台根 */
export function isSplitSidebarExcludedRoot(item: MenuDataItem): boolean {
  if (item.hideInMenu === true) return true;
  if (item.path === '/system') return true;
  return treeHasInfraPath(item);
}

export function buildSplitMenuRoots(items: MenuDataItem[]): MenuDataItem[] {
  return items.filter((item) => !isSplitSidebarExcludedRoot(item));
}

export function computeSplitSecondaryOpenKeys(
  roots: MenuDataItem[],
  currentPath: string,
  computeOpenKeys: (items: MenuDataItem[], path: string) => string[],
): string[] {
  const activeKey = findActiveRootKey(roots, currentPath);
  const activeRoot = roots.find((item) => menuItemKey(item) === activeKey);
  if (!activeRoot?.children?.length) return [];
  return computeOpenKeys(activeRoot.children, currentPath);
}
