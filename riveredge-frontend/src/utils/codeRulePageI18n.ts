import type { TFunction } from 'i18next';

import { isCodeRulePageCode } from './generated/codeRulePageRegistry';

function translateOrFallback(t: TFunction, key: string, fallback: string): string {
  const translated = t(key);
  return translated !== key ? translated : fallback;
}

function pageFieldKey(pageCode: string, field: 'pageName' | 'codeFieldLabel'): string {
  return `codeRulePage.${pageCode}.${field}`;
}

function moduleKey(moduleZh: string): string {
  return `codeRulePage.module.${moduleZh}`;
}

export function resolveCodeRulePageName(
  page: { pageCode?: string; pageName?: string | null },
  t: TFunction,
): string {
  const fallback = page.pageName ?? '';
  if (!page.pageCode || !isCodeRulePageCode(page.pageCode)) return fallback;
  return translateOrFallback(t, pageFieldKey(page.pageCode, 'pageName'), fallback);
}

export function resolveCodeRulePageCodeFieldLabel(
  page: { pageCode?: string; codeFieldLabel?: string | null },
  t: TFunction,
): string {
  const fallback = page.codeFieldLabel ?? '';
  if (!page.pageCode || !isCodeRulePageCode(page.pageCode)) return fallback;
  return translateOrFallback(t, pageFieldKey(page.pageCode, 'codeFieldLabel'), fallback);
}

export function resolveCodeRulePageModule(module: string | undefined, t: TFunction): string {
  if (!module) return '';
  return translateOrFallback(t, moduleKey(module), module);
}
