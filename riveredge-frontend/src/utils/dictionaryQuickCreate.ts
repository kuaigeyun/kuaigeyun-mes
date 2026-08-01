/**
 * 字典项快速新建防重（唯一真源：与后端 create_item 同规则 — 同字典内 value/label 去空白后不可重复）
 */

export type DictionaryOptionLike = { label: string; value: string };

export function normalizeDictionaryToken(raw: unknown): string {
  return String(raw ?? '').trim();
}

/** 下拉选项按 value 去重，避免历史脏数据在下拉中重复展示 */
export function dedupeDictionaryOptionsByValue<T extends DictionaryOptionLike>(options: T[]): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];
  for (const option of options) {
    const key = normalizeDictionaryToken(option.value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(option);
  }
  return deduped;
}

export function findExistingDictionaryOption(
  options: DictionaryOptionLike[],
  candidate: { label: string; value: string },
): DictionaryOptionLike | undefined {
  const label = normalizeDictionaryToken(candidate.label);
  const value = normalizeDictionaryToken(candidate.value);
  if (!label && !value) return undefined;
  return options.find((option) => {
    const optionLabel = normalizeDictionaryToken(option.label);
    const optionValue = normalizeDictionaryToken(option.value);
    return (value && optionValue === value) || (label && optionLabel === label);
  });
}

/** 快速新建（value 通常与 label 相同）时的标准 value */
export function dictionaryQuickCreateValueFromLabel(label: string): string {
  return normalizeDictionaryToken(label);
}
