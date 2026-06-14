/** 键值对行（表单模式） */
export interface JsonKeyValuePair {
  key: string;
  value: string;
}

const PRIMITIVE_JSON_TYPES = new Set(['string', 'number', 'boolean']);

/** 是否为可用键值对模式编辑的扁平对象 */
export function isFlatJsonObject(value: unknown): value is Record<string, string | number | boolean | null> {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every(
    (v) => v == null || PRIMITIVE_JSON_TYPES.has(typeof v),
  );
}

export function jsonValueToKeyValuePairs(value: unknown): JsonKeyValuePair[] {
  if (!isFlatJsonObject(value) || Object.keys(value).length === 0) {
    return [{ key: '', value: '' }];
  }
  return Object.entries(value).map(([key, val]) => ({
    key,
    value: val == null ? '' : String(val),
  }));
}

export function keyValuePairsToJsonObject(pairs: JsonKeyValuePair[]): Record<string, string | number | boolean | null> | null {
  const result: Record<string, string | number | boolean | null> = {};
  let hasEntry = false;
  for (const pair of pairs) {
    const key = pair.key.trim();
    if (!key) continue;
    hasEntry = true;
    const raw = pair.value.trim();
    if (raw === '') {
      result[key] = null;
      continue;
    }
    if (raw === 'true') {
      result[key] = true;
      continue;
    }
    if (raw === 'false') {
      result[key] = false;
      continue;
    }
    if (/^-?\d+(\.\d+)?$/.test(raw)) {
      result[key] = Number(raw);
      continue;
    }
    result[key] = pair.value;
  }
  return hasEntry ? result : null;
}

export function formatJsonText(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return trimmed;
    }
  }
  return JSON.stringify(value, null, 2);
}

export function parseJsonText(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true, value: null };
  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch {
    return { ok: false, error: 'JSON 格式不正确，请检查括号、引号或逗号' };
  }
}

export function normalizeJsonFieldValue(value: unknown): unknown {
  if (value == null || value === '') return null;
  if (typeof value === 'string') {
    const parsed = parseJsonText(value);
    return parsed.ok ? parsed.value : value;
  }
  return value;
}

export function isEmptyJsonValue(value: unknown): boolean {
  if (value == null || value === '') return true;
  if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).length === 0) {
    return true;
  }
  return false;
}
