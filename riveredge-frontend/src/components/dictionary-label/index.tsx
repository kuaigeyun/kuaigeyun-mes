import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { DictionaryItem } from '../../services/dataDictionary';
import {
  getDictionaryItemsCached,
  getDictionaryItemsSync,
} from '../../services/dataDictionaryCache';
import { resolveSystemDictionaryItemLabel } from '../../utils/systemDictionaryI18n';

interface DictionaryLabelProps {
  /** 字典代码 */
  dictionaryCode: string;
  /** 字典项的值 */
  value?: string | number;
  /** 加载中显示的占位符（默认空串，避免列表里闪烁原始 code） */
  loadingPlaceholder?: string;
  /** 未找到值时显示的占位符（默认空串，避免回退到原始 code） */
  notFoundPlaceholder?: string;
  /** 容器样式 */
  style?: React.CSSProperties;
  /** 容器类名 */
  className?: string;
}

function findDictionaryItem(items: DictionaryItem[], raw: string | number): DictionaryItem | undefined {
  const s = String(raw).trim();
  if (!s) return undefined;
  const exact = items.find(
    (i) => String(i.value).trim() === s || String(i.label).trim() === s
  );
  if (exact) return exact;
  const low = s.toLowerCase();
  return items.find(
    (i) =>
      String(i.value).trim().toLowerCase() === low || String(i.label).trim().toLowerCase() === low
  );
}

function resolveLabelSync(
  code: string,
  value: string | number | undefined,
  notFoundPlaceholder: string | undefined,
  t: (key: string) => string,
): string | null {
  if (value === undefined || value === null || value === '') return null;
  const items = getDictionaryItemsSync(code);
  if (!items) return null;
  const item = findDictionaryItem(items, value);
  if (!item) return notFoundPlaceholder ?? '';
  return resolveSystemDictionaryItemLabel(code, item, t);
}

/**
 * 数据字典标签显示组件
 *
 * 根据字典代码和值，显示对应的字典项标签（Label）。
 *
 * 缓存策略：每次 value/dictionaryCode 变化均请求最新字典项。
 */
export const DictionaryLabel: React.FC<DictionaryLabelProps> = ({
  dictionaryCode,
  value,
  loadingPlaceholder = '',
  notFoundPlaceholder,
  style,
  className,
}) => {
  const { t } = useTranslation();
  const [label, setLabel] = useState<string | null>(() =>
    resolveLabelSync(dictionaryCode, value, notFoundPlaceholder, t),
  );

  useEffect(() => {
    let cancelled = false;
    const sync = resolveLabelSync(dictionaryCode, value, notFoundPlaceholder, t);
    setLabel(sync);
    if (sync !== null) return;
    if (value === undefined || value === null || value === '') return;

    getDictionaryItemsCached(dictionaryCode)
      .then((items) => {
        if (cancelled) return;
        const item = findDictionaryItem(items, value);
        setLabel(
          item
            ? resolveSystemDictionaryItemLabel(dictionaryCode, item, t)
            : (notFoundPlaceholder ?? ''),
        );
      })
      .catch((error) => {
        console.error(`加载字典标签失败 (${dictionaryCode}):`, error);
        if (!cancelled) setLabel(notFoundPlaceholder ?? '');
      });

    return () => {
      cancelled = true;
    };
  }, [dictionaryCode, value, notFoundPlaceholder, t]);

  return (
    <span style={style} className={className}>
      {label ?? loadingPlaceholder}
    </span>
  );
};

export default DictionaryLabel;
