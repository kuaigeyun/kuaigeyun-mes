import type { TFunction } from 'i18next';

import { isCustomFieldPageCode } from './generated/customFieldPageRegistry';

function translateOrFallback(t: TFunction, key: string, fallback: string): string {
  const translated = t(key);
  return translated !== key ? translated : fallback;
}

function pageFieldKey(pageCode: string, field: 'pageName' | 'tableNameLabel'): string {
  return `customFieldPage.${pageCode}.${field}`;
}

export function resolveCustomFieldPageName(
  page: { pageCode?: string; pageName?: string | null },
  t: TFunction,
): string {
  const fallback = page.pageName ?? '';
  if (!page.pageCode || !isCustomFieldPageCode(page.pageCode)) return fallback;
  return translateOrFallback(t, pageFieldKey(page.pageCode, 'pageName'), fallback);
}

export function resolveCustomFieldPageTableNameLabel(
  page: { pageCode?: string; tableNameLabel?: string | null },
  t: TFunction,
): string {
  const fallback = page.tableNameLabel ?? '';
  if (!page.pageCode || !isCustomFieldPageCode(page.pageCode)) return fallback;
  return translateOrFallback(t, pageFieldKey(page.pageCode, 'tableNameLabel'), fallback);
}
