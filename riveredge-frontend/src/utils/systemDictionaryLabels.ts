import type { TFunction } from 'i18next';

const CURRENCY_VALUE_I18N: Record<string, string> = {
  CNY: 'pages.system.siteSettings.currencyCNY',
  USD: 'pages.system.siteSettings.currencyUSD',
  EUR: 'pages.system.siteSettings.currencyEUR',
  JPY: 'pages.system.siteSettings.currencyJPY',
  GBP: 'pages.system.siteSettings.currencyGBP',
};

/** 与 system_dictionaries TIMEZONE 项 value 一一对应 */
export const SYSTEM_TIMEZONE_VALUES = [
  'Etc/GMT+12',
  'Etc/GMT+11',
  'Pacific/Honolulu',
  'America/Anchorage',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Halifax',
  'America/Sao_Paulo',
  'America/Argentina/Buenos_Aires',
  'Etc/GMT+2',
  'Atlantic/Azores',
  'Etc/UTC',
  'Europe/London',
  'Europe/Paris',
  'Europe/Athens',
  'Africa/Cairo',
  'Asia/Jerusalem',
  'Europe/Moscow',
  'Asia/Baghdad',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Asia/Bangkok',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Australia/Perth',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Darwin',
  'Australia/Sydney',
  'Australia/Brisbane',
  'Pacific/Guadalcanal',
  'Pacific/Auckland',
  'Pacific/Tongatapu',
] as const;

export const SYSTEM_CURRENCY_VALUES = ['CNY', 'USD', 'EUR', 'JPY', 'GBP'] as const;

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

export function buildFallbackCurrencyOptions(t: TFunction): Array<{ value: string; label: string }> {
  return SYSTEM_CURRENCY_VALUES.map((value) => ({
    value,
    label: getLocalizedCurrencyLabel(value, t),
  }));
}

export function buildFallbackTimezoneOptions(t: TFunction): Array<{ value: string; label: string }> {
  return [
    'Asia/Shanghai',
    'Asia/Tokyo',
    'Asia/Seoul',
    'America/New_York',
    'Europe/London',
    'Europe/Paris',
  ].map((value) => ({
    value,
    label: getLocalizedTimezoneLabel(value, t),
  }));
}
