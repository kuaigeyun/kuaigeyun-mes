import type { TFunction } from 'i18next';

import {
  getDataDictionaryByCode,
  getDictionaryItemList,
} from '../services/dataDictionary';
import { mapSystemDictionaryItemOptions } from './systemDictionaryI18n';

/** 导入「是否启用」列常用选项（与 parseActive 中文分支一致） */
export const IMPORT_YES_NO_OPTIONS = ['是', '否'] as const;

/** 销售/采购价格类型存库值 */
export const IMPORT_PRICE_TYPE_OPTIONS = ['tax_inclusive', 'tax_exclusive'] as const;

/**
 * 若示例值不在选项中，回落到首个选项（避免下拉校验把示例标红）。
 */
export function pickImportExampleValue(options: string[] | undefined, fallback: string): string {
  if (!options?.length) return fallback;
  return options.includes(fallback) ? fallback : options[0] ?? fallback;
}

/**
 * 加载字典项存库值列表，供导入列下拉使用（与 DictionarySelect 存库值一致）。
 */
export async function loadImportDictionaryValues(
  dictionaryCode: string,
  t: TFunction,
  hostResource?: string,
): Promise<string[]> {
  const loadOpts = hostResource ? { hostResource } : undefined;
  const dictionary = await getDataDictionaryByCode(dictionaryCode, loadOpts);
  const items = await getDictionaryItemList(dictionary.uuid, true, loadOpts);
  return mapSystemDictionaryItemOptions(dictionaryCode, items, t)
    .map((o) => String(o.value ?? '').trim())
    .filter(Boolean);
}
