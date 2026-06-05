import { useCallback, useEffect, useState } from 'react';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../services/dataDictionary';

export const HAOLIGO_EQUIPMENT_OPERATIONAL_STATUS_DICT = 'HAOLIGO_EQUIPMENT_OPERATIONAL_STATUS';

const FALLBACK_LABELS: Record<string, string> = {
  running: '运行',
  repair: '维修',
  upkeep: '保养',
  shutdown: '停机',
  standby: '待机',
};

export type EquipmentOperationalStatusOption = { label: string; value: string };

function fallbackStatusOptions(): EquipmentOperationalStatusOption[] {
  return Object.entries(FALLBACK_LABELS).map(([value, label]) => ({ value, label }));
}

export function useEquipmentOperationalStatusLabels() {
  const [labelByValue, setLabelByValue] = useState<Record<string, string>>(FALLBACK_LABELS);
  const [statusOptions, setStatusOptions] = useState<EquipmentOperationalStatusOption[]>(fallbackStatusOptions);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const dict = await getDataDictionaryByCode(HAOLIGO_EQUIPMENT_OPERATIONAL_STATUS_DICT);
        if (!dict?.uuid || cancelled) return;
        const items = await getDictionaryItemList(dict.uuid, { is_active: true });
        if (cancelled) return;
        const map: Record<string, string> = { ...FALLBACK_LABELS };
        const opts: EquipmentOperationalStatusOption[] = [];
        for (const it of items) {
          const v = String(it.value ?? '').trim().toLowerCase();
          if (!v) continue;
          const label = String(it.label ?? it.value ?? v).trim() || v;
          map[v] = label;
          opts.push({ value: v, label });
        }
        setLabelByValue(map);
        setStatusOptions(opts.length ? opts : fallbackStatusOptions());
      } catch {
        if (!cancelled) {
          setLabelByValue(FALLBACK_LABELS);
          setStatusOptions(fallbackStatusOptions());
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const formatStatus = useCallback(
    (value: string | null | undefined, emptyLabel = '—') => {
      if (value == null || value === '') return emptyLabel;
      const key = String(value).trim().toLowerCase();
      return labelByValue[key] ?? String(value);
    },
    [labelByValue],
  );

  return { labelByValue, formatStatus, statusOptions };
}
