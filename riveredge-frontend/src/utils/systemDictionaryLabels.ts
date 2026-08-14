import type { TFunction } from 'i18next';

const CURRENCY_VALUE_I18N: Record<string, string> = {
  CNY: 'pages.system.siteSettings.currencyCNY',
  USD: 'pages.system.siteSettings.currencyUSD',
  EUR: 'pages.system.siteSettings.currencyEUR',
  JPY: 'pages.system.siteSettings.currencyJPY',
  GBP: 'pages.system.siteSettings.currencyGBP',
};

export function timezoneValueToI18nKey(value: string): string {
  const slug = value.replace(/\//g, '_').replace(/\+/g, '_plus_');
  return `pages.system.siteSettings.timezoneValue.${slug}`;
}

export function currencyValueToI18nKey(value: string): string {
  return CURRENCY_VALUE_I18N[value] ?? `pages.system.siteSettings.currencyValue.${value}`;
}

function translateOrFallback(t: TFunction, key: string, fallback?: string): string {
  const translated = t(key);
  if (translated !== key) return translated;
  return fallback ?? key;
}

export function getLocalizedCurrencyLabel(value: string, t: TFunction, fallbackLabel?: string): string {
  return translateOrFallback(t, currencyValueToI18nKey(value), fallbackLabel ?? value);
}

export function getLocalizedTimezoneLabel(value: string, t: TFunction, fallbackLabel?: string): string {
  return translateOrFallback(t, timezoneValueToI18nKey(value), fallbackLabel ?? value);
}

export function mapCurrencyDictionaryOptions<T extends { value: string; label: string }>(
  items: T[],
  t: TFunction,
): Array<{ value: string; label: string }> {
  return items.map((item) => ({
    value: item.value,
    label: getLocalizedCurrencyLabel(item.value, t, item.label),
  }));
}

export function mapTimezoneDictionaryOptions<T extends { value: string; label: string }>(
  items: T[],
  t: TFunction,
): Array<{ value: string; label: string }> {
  return items.map((item) => ({
    value: item.value,
    label: getLocalizedTimezoneLabel(item.value, t, item.label),
  }));
}
