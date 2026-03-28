import React, { useState, useEffect } from 'react';
import { getDictionaryItemList, getDataDictionaryByCode, type DictionaryItem } from '../../services/dataDictionary';

interface DictionaryLabelProps {
  /** 字典代码 */
  dictionaryCode: string;
  /** 字典项的值 */
  value?: string | number;
  /** 加载中显示的占位符 */
  loadingPlaceholder?: string;
  /** 未找到值时显示的占位符 */
  notFoundPlaceholder?: string;
  /** 容器样式 */
  style?: React.CSSProperties;
  /** 容器类名 */
  className?: string;
}

const dictionaryCache: Record<string, DictionaryItem[]> = {};

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

/**
 * 数据字典标签显示组件
 * 
 * 根据字典代码和值，显示对应的字典项标签（Label）。
 */
export const DictionaryLabel: React.FC<DictionaryLabelProps> = ({
  dictionaryCode,
  value,
  loadingPlaceholder = '...',
  notFoundPlaceholder,
  style,
  className,
}) => {
  const [label, setLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (value === undefined || value === null || value === '') {
      setLabel(null);
      return;
    }

    const fetchLabel = async () => {
      // 检查缓存
      if (dictionaryCache[dictionaryCode]) {
        const item = findDictionaryItem(dictionaryCache[dictionaryCode], value);
        setLabel(item ? item.label : (notFoundPlaceholder ?? String(value)));
        return;
      }

      try {
        setLoading(true);
        const dictionary = await getDataDictionaryByCode(dictionaryCode);
        const items = await getDictionaryItemList(dictionary.uuid, true);
        dictionaryCache[dictionaryCode] = items;
        
        const item = findDictionaryItem(items, value);
        setLabel(item ? item.label : (notFoundPlaceholder ?? String(value)));
      } catch (error) {
        console.error(`加载字典标签失败 (${dictionaryCode}):`, error);
        setLabel(notFoundPlaceholder ?? String(value));
      } finally {
        setLoading(false);
      }
    };

    fetchLabel();
  }, [dictionaryCode, value, notFoundPlaceholder]);

  if (loading && !label) {
    return <span style={style} className={className}>{loadingPlaceholder}</span>;
  }

  return <span style={style} className={className}>{label ?? ''}</span>;
};

export default DictionaryLabel;
