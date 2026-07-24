import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { loadImportDictionaryValues } from '../utils/loadImportDictionaryValues';

/**
 * 批量加载导入列下拉用的字典存库值（与 DictionarySelect 一致）。
 */
export function useImportDictionaryOptions(dictionaryCodes: string[]): Record<string, string[]> {
  const { t, i18n } = useTranslation();
  const [optionsByCode, setOptionsByCode] = useState<Record<string, string[]>>({});

  const codesKey = dictionaryCodes.join('\0');

  useEffect(() => {
    let cancelled = false;
    const codes = codesKey ? codesKey.split('\0').filter(Boolean) : [];
    if (!codes.length) {
      setOptionsByCode({});
      return undefined;
    }

    void (async () => {
      const entries = await Promise.all(
        codes.map(async (code) => {
          try {
            const values = await loadImportDictionaryValues(code, t);
            return [code, values] as const;
          } catch (error) {
            console.warn(`load import dictionary options failed (${code}):`, error);
            return [code, [] as string[]] as const;
          }
        }),
      );
      if (!cancelled) {
        setOptionsByCode(Object.fromEntries(entries));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [codesKey, t, i18n.language]);

  return optionsByCode;
}
