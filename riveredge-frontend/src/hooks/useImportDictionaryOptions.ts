import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  loadImportDictionaryOptionPack,
  parseImportCodedCell,
  type ImportCodeLabelMap,
  type ImportDictionaryOptionPack,
} from '../utils/loadImportDictionaryValues';

export type UseImportDictionaryOptionsResult = Record<string, string[] | undefined> & {
  /** 单元格 → 存库 value */
  parseDict: (dictionaryCode: string, raw?: string | null) => string | undefined;
  packs: Record<string, ImportDictionaryOptionPack>;
};

/**
 * 批量加载导入列下拉：展示本地化 label；导入确认时用 parseDict 还原存库值。
 * 兼容旧用法：`result.CUSTOMER_CATEGORY` 即为该字典下拉文案数组。
 */
export function useImportDictionaryOptions(dictionaryCodes: string[]): UseImportDictionaryOptionsResult {
  const { t, i18n } = useTranslation();
  const [packs, setPacks] = useState<Record<string, ImportDictionaryOptionPack>>({});

  const codesKey = dictionaryCodes.join('\0');

  useEffect(() => {
    let cancelled = false;
    const codes = codesKey ? codesKey.split('\0').filter(Boolean) : [];
    if (!codes.length) {
      setPacks({});
      return undefined;
    }

    void (async () => {
      const entries = await Promise.all(
        codes.map(async (code) => {
          try {
            const pack = await loadImportDictionaryOptionPack(code, t);
            return [code, pack] as const;
          } catch (error) {
            console.warn(`load import dictionary options failed (${code}):`, error);
            return [code, buildEmptyPack()] as const;
          }
        }),
      );
      if (!cancelled) {
        setPacks(Object.fromEntries(entries));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [codesKey, t, i18n.language]);

  const options = useMemo(() => {
    const next: Record<string, string[]> = {};
    for (const [code, pack] of Object.entries(packs)) {
      next[code] = pack.options;
    }
    return next;
  }, [packs]);

  const labelMaps = useMemo(() => {
    const next: Record<string, ImportCodeLabelMap> = {};
    for (const [code, pack] of Object.entries(packs)) {
      next[code] = pack.labelByCode;
    }
    return next;
  }, [packs]);

  const parseDict = useMemo(
    () => (dictionaryCode: string, raw?: string | null) =>
      parseImportCodedCell(raw, labelMaps[dictionaryCode]),
    [labelMaps],
  );

  return useMemo(
    () =>
      Object.assign(options, {
        parseDict,
        packs,
      }) as UseImportDictionaryOptionsResult,
    [options, parseDict, packs],
  );
}

function buildEmptyPack(): ImportDictionaryOptionPack {
  return {
    options: [],
    labelByCode: {},
    parse: (raw) => {
      const v = String(raw ?? '').trim();
      return v || undefined;
    },
  };
}
