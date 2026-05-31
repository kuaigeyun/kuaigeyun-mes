/** 模具保养项取值类型（与后端 value_type 一致，仅 text / multiselect） */

import {
  formatMultiselectMeasuredValue,
  parseMultiselectMeasuredValue,
} from './inspectionParamValueType';

export type MoldUpkeepValueTypeKey = 'text' | 'multiselect';

export function normalizeMoldUpkeepValueType(raw?: string | null): MoldUpkeepValueTypeKey {
  const v = (raw ?? 'text').trim().toLowerCase();
  if (v === 'multiselect' || v === 'multi_select' || v === 'multi' || v === '多选') return 'multiselect';
  if (v === 'text' || v === '文本') return 'text';
  return 'text';
}

export { formatMultiselectMeasuredValue, parseMultiselectMeasuredValue };

export function normalizeMoldUpkeepParamOptions(
  valueType: string,
  raw: unknown,
): string | null {
  const vt = normalizeMoldUpkeepValueType(valueType);
  if (vt !== 'multiselect') {
    if (raw == null || raw === '') return null;
    return String(raw).trim() || null;
  }
  if (Array.isArray(raw)) {
    return formatMultiselectMeasuredValue(raw.map(String));
  }
  return formatMultiselectMeasuredValue(parseMultiselectMeasuredValue(String(raw ?? '')));
}

export function formatUpkeepRecordValueForSubmit(
  valueType: string,
  raw: unknown,
): string | null {
  const vt = normalizeMoldUpkeepValueType(valueType);
  if (raw == null || raw === '') return null;
  if (vt === 'multiselect') {
    if (Array.isArray(raw)) {
      return formatMultiselectMeasuredValue(raw.map(String));
    }
    return formatMultiselectMeasuredValue(parseMultiselectMeasuredValue(String(raw)));
  }
  return String(raw).trim() || null;
}
