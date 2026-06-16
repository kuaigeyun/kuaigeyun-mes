import type { TFunction } from 'i18next';

import type { DataDictionary, DictionaryItem } from '../services/dataDictionary';
import {
  getLocalizedCurrencyLabel,
  getLocalizedTimezoneLabel,
} from './systemDictionaryLabels';

/** 字典项 value 转 locale 键段（与生成脚本一致） */
export function systemDictionaryItemValueKey(value: string): string {
  return value.replace(/\//g, '__');
}

export function systemDictionaryNameKey(code: string): string {
  return `systemDictionary.${code}.name`;
}

export function systemDictionaryDescKey(code: string): string {
  return `systemDictionary.${code}.desc`;
}

export function systemDictionaryItemLabelKey(code: string, value: string): string {
  return `systemDictionary.${code}.item.${systemDictionaryItemValueKey(value)}.label`;
}

export function systemDictionaryItemDescKey(code: string, value: string): string {
  return `systemDictionary.${code}.item.${systemDictionaryItemValueKey(value)}.desc`;
}

function translateOrFallback(t: TFunction, key: string, fallback: string): string {
  const translated = t(key);
  return translated !== key ? translated : fallback;
}

export function resolveSystemDictionaryName(
  record: Pick<DataDictionary, 'code' | 'name' | 'is_system'>,
  t: TFunction,
): string {
  if (!record.is_system || !record.code) return record.name ?? '';
  return translateOrFallback(t, systemDictionaryNameKey(record.code), record.name ?? '');
}

export function resolveSystemDictionaryDescription(
  record: Pick<DataDictionary, 'code' | 'description' | 'is_system'>,
  t: TFunction,
): string {
  if (!record.is_system || !record.code) return record.description ?? '';
  return translateOrFallback(t, systemDictionaryDescKey(record.code), record.description ?? '');
}

export function resolveSystemDictionaryItemLabel(
  dictionaryCode: string,
  item: Pick<DictionaryItem, 'value' | 'label' | 'is_system_managed'>,
  t: TFunction,
): string {
  if (item.is_system_managed !== true) return item.label;

  if (dictionaryCode === 'CURRENCY') {
    return getLocalizedCurrencyLabel(item.value, t, item.label);
  }
  if (dictionaryCode === 'TIMEZONE') {
    return getLocalizedTimezoneLabel(item.value, t, item.label);
  }

  return translateOrFallback(
    t,
    systemDictionaryItemLabelKey(dictionaryCode, item.value),
    item.label,
  );
}

export function resolveSystemDictionaryItemDescription(
  dictionaryCode: string,
  item: Pick<DictionaryItem, 'value' | 'description' | 'is_system_managed'>,
  t: TFunction,
): string {
  if (item.is_system_managed !== true) return item.description ?? '';

  if (dictionaryCode === 'CURRENCY' || dictionaryCode === 'TIMEZONE') {
    return item.description ?? '';
  }

  const fallback = item.description ?? '';
  if (!fallback) return '';
  return translateOrFallback(
    t,
    systemDictionaryItemDescKey(dictionaryCode, item.value),
    fallback,
  );
}

export function mapSystemDictionaryItemOptions(
  dictionaryCode: string,
  items: DictionaryItem[],
  t: TFunction,
): Array<{ label: string; value: string }> {
  return items.map((item) => ({
    value: item.value,
    label: resolveSystemDictionaryItemLabel(dictionaryCode, item, t),
  }));
}
