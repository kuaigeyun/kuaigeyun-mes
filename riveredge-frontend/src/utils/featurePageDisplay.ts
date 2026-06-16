/**
 * 功能页面展示名称解析（与导航菜单 / manifest / locale 对齐）
 * 用于编号规则、自定义字段等左栏功能列表
 */

import type { TFunction } from 'i18next';
import type { MenuTree } from '../services/menu';
import {
  extractAppCodeFromPath,
  getAppDisplayName,
  translateAppMenuItemName,
  translateMenuName,
} from './menuTranslation';
import {
  resolveCodeRulePageCodeFieldLabel,
  resolveCodeRulePageModule,
  resolveCodeRulePageName,
} from './codeRulePageI18n';
import {
  resolveCustomFieldPageName,
  resolveCustomFieldPageTableNameLabel,
} from './customFieldPageI18n';

export interface PageWithMenuDisplay {
  pageCode?: string;
  pageName: string;
  pagePath: string;
  module?: string;
  codeFieldLabel?: string;
  tableNameLabel?: string;
}

export function normalizePagePath(path?: string): string {
  return (path ?? '').replace(/\/$/, '') || '';
}

function isI18nKey(text: string): boolean {
  return text.includes('.') && !text.startsWith('/');
}

/** 从导航菜单树构建 path -> 已翻译菜单名称 映射 */
export function buildMenuPathNameMap(
  menus: MenuTree[],
  t: TFunction,
): Map<string, string> {
  const map = new Map<string, string>();

  const walk = (nodes: MenuTree[]) => {
    for (const node of nodes) {
      const path = normalizePagePath(node.path);
      if (path && node.name) {
        const translated = translateAppMenuItemName(node.name, node.path, t, node.children);
        const label = translated || translateMenuName(node.name, t, node.path);
        if (label && !isI18nKey(label)) {
          map.set(path, label);
        }
      }
      if (node.children?.length) {
        walk(node.children);
      }
    }
  };

  walk(menus);
  return map;
}

/** 解析模块分组标题：应用页用 app.{code}.name，系统页用 menu.system */
export function resolveModuleDisplayName(
  module: string | undefined,
  pagePath: string | undefined,
  t: TFunction,
): string {
  const path = normalizePagePath(pagePath);
  if (path.startsWith('/apps/')) {
    const appCode = extractAppCodeFromPath(path);
    if (appCode) {
      const appName = getAppDisplayName(appCode, t, module);
      if (appName && !isI18nKey(appName)) {
        return appName;
      }
    }
  }
  if (path.startsWith('/system/')) {
    const systemName = t('menu.system', { defaultValue: '系统配置' });
    if (systemName && systemName !== 'menu.system') {
      return systemName;
    }
  }
  if (module) {
    const translated = translateMenuName(module, t, path);
    if (translated && !isI18nKey(translated)) {
      return translated;
    }
    const fromCodeRule = resolveCodeRulePageModule(module, t);
    if (fromCodeRule && fromCodeRule !== module) {
      return fromCodeRule;
    }
  }
  return module || '';
}

/** 优先使用已翻译菜单名，回退到 API/manifest 配置的 pageName */
export function resolvePageDisplayName(
  page: PageWithMenuDisplay,
  menuPathNameMap: Map<string, string>,
  t: TFunction,
): string {
  const path = normalizePagePath(page.pagePath);

  if (path && menuPathNameMap.has(path)) {
    const fromMenu = menuPathNameMap.get(path)!;
    if (fromMenu && !isI18nKey(fromMenu)) {
      return fromMenu;
    }
  }

  if (page.pageCode) {
    const fromCodeRule = resolveCodeRulePageName(page, t);
    if (fromCodeRule && !isI18nKey(fromCodeRule) && fromCodeRule !== page.pageCode) {
      return fromCodeRule;
    }
    const fromCustomField = resolveCustomFieldPageName(page, t);
    if (fromCustomField && !isI18nKey(fromCustomField) && fromCustomField !== page.pageCode) {
      return fromCustomField;
    }
  }

  const fromApi = translateMenuName(page.pageName, t, path);
  if (fromApi && !isI18nKey(fromApi)) {
    return fromApi;
  }

  return page.pageCode;
}

/** 用导航菜单名称与应用 locale 覆盖展示字段，供左栏功能列表使用 */
export function enrichPagesWithMenuNames<T extends PageWithMenuDisplay>(
  pages: T[],
  menuPathNameMap: Map<string, string>,
  t: TFunction,
): T[] {
  return pages.map((page) => ({
    ...page,
    pageName: resolvePageDisplayName(page, menuPathNameMap, t),
    ...(page.module !== undefined
      ? { module: resolveModuleDisplayName(page.module, page.pagePath, t) }
      : {}),
    ...(page.codeFieldLabel !== undefined
      ? { codeFieldLabel: resolveCodeRulePageCodeFieldLabel(page, t) }
      : {}),
    ...(page.tableNameLabel !== undefined
      ? { tableNameLabel: resolveCustomFieldPageTableNameLabel(page, t) }
      : {}),
  }));
}
