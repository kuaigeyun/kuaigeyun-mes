/** 表单多选存库：逗号分隔或 JSON 数组字符串 ↔ 字符串数组 */

export function parseMultiselectStoredValue(
  raw: string | string[] | null | undefined,
): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter(Boolean);
  }
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
    .split(/[,，、]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function formatMultiselectStoredValue(values: string[] | null | undefined): string {
  if (!values?.length) return '';
  const parts = values.map((x) => String(x).trim()).filter(Boolean);
  return parts.length ? parts.join(',') : '';
}
