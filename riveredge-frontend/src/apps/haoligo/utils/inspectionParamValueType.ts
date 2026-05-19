/** 点检项取值类型（与后端 value_type 字段一致） */

export type InspectionValueTypeKey = 'numeric' | 'text' | 'boolean' | 'multiselect';

export function normalizeInspectionValueType(raw?: string | null): InspectionValueTypeKey {
  const v = (raw ?? 'numeric').trim().toLowerCase();
  if (v === 'text' || v === '文本') return 'text';
  if (v === 'boolean' || v === 'bool' || v === '是否') return 'boolean';
  if (v === 'multiselect' || v === 'multi_select' || v === 'multi' || v === '多选') return 'multiselect';
  if (v === 'numeric' || v === 'number' || v === '数值') return 'numeric';
  return 'numeric';
}

/** 实测值/默认值：逗号分隔或 JSON 数组字符串 → 字符串数组 */
export function parseMultiselectMeasuredValue(raw: string | null | undefined): string[] {
  if (raw == null) return [];
  const s = String(raw).trim();
  if (!s) return [];
  if (s.startsWith('[')) {
    try {
      const arr = JSON.parse(s) as unknown;
      if (Array.isArray(arr)) {
        return arr.map((x) => String(x).trim()).filter(Boolean);
      }
    } catch {
      /* fall through */
    }
  }
  return s
    .split(/[,，]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function formatMultiselectMeasuredValue(values: string[] | null | undefined): string | null {
  if (!values?.length) return null;
  const parts = values.map((x) => String(x).trim()).filter(Boolean);
  return parts.length ? parts.join(',') : null;
}
