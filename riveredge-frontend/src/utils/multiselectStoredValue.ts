/** 表单多选存库：英文逗号分隔或 JSON 数组字符串 ↔ 字符串数组 */

/**
 * 仅按 ASCII 逗号 `,` 拆分。
 * 不得把中文顿号 `、` / 全角逗号 `，` 当作分隔符：字典项文案常含顿号
 *（如「密封圈拉伤、漏水」），误拆会导致「只选一项却显示多项」且无法点掉幽灵项。
 */
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
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

export function formatMultiselectStoredValue(values: string[] | null | undefined): string {
  if (!values?.length) return '';
  const parts = values.map((x) => String(x).trim()).filter(Boolean);
  return parts.length ? parts.join(',') : '';
}

/** 快速新建字典项时禁止写入存库分隔符，避免多选拆分歧义 */
export function dictionaryItemValueContainsStorageDelimiter(text: string): boolean {
  return text.includes(',');
}
