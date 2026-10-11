import {
  isEmptyJsonValue,
  normalizeJsonFieldValue,
} from '../../../components/custom-fields/customFieldJsonUtils';

/** 键值对行（Headers / Params 表单） */
export interface ApiKeyValueRow {
  key?: string;
  value?: string;
}

/** 将对象转为键值对数组，用于 Headers / Params 表单 */
export function objectToKeyValueList(
  obj: Record<string, unknown> | undefined | null,
): ApiKeyValueRow[] {
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj).map(([key, value]) => ({
    key,
    value: typeof value === 'string' ? value : JSON.stringify(value),
  }));
}

/** 将键值对数组转为对象，用于 Headers / Params 提交 */
export function keyValueListToObject(
  list: ApiKeyValueRow[] | undefined,
): Record<string, unknown> {
  if (!Array.isArray(list)) return {};
  return list.reduce<Record<string, unknown>>((acc, { key, value }) => {
    if (!key) return acc;
    if (value === undefined || value === '') {
      acc[key] = '';
      return acc;
    }
    const trimmed = value.trim();
    if (
      trimmed.startsWith('{') ||
      trimmed.startsWith('[') ||
      trimmed === 'true' ||
      trimmed === 'false'
    ) {
      try {
        acc[key] = JSON.parse(trimmed);
      } catch {
        acc[key] = value;
      }
    } else if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      acc[key] = Number(trimmed);
    } else {
      acc[key] = value;
    }
    return acc;
  }, {});
}

export const DEFAULT_API_REQUEST_PAGE_SIZE = 1000;

const REQUEST_BODY_PAGE_NO_KEYS = ['pageNo', 'page_no'] as const;
const REQUEST_BODY_PAGE_SIZE_KEYS = ['pageSize', 'page_size'] as const;

function hasOwnKey(obj: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) return key;
  }
  return null;
}

function looksLikeExecuteBillQueryBody(body: Record<string, unknown>): boolean {
  return (
    Object.prototype.hasOwnProperty.call(body, 'FormId') ||
    Object.prototype.hasOwnProperty.call(body, 'formId')
  );
}

/** 新建/空请求体默认带分页；已有 pageNo 但缺少 pageSize 时补 1000 */
export function applyRequestBodyFormDefaults(value: unknown): unknown {
  const normalized = normalizeJsonFieldValue(value);
  if (isEmptyJsonValue(normalized)) {
    return { pageNo: 1, pageSize: DEFAULT_API_REQUEST_PAGE_SIZE };
  }
  if (!normalized || typeof normalized !== 'object' || Array.isArray(normalized)) {
    return normalized;
  }
  const body = { ...(normalized as Record<string, unknown>) };
  if (looksLikeExecuteBillQueryBody(body)) return body;

  const pageNoKey = hasOwnKey(body, REQUEST_BODY_PAGE_NO_KEYS);
  const pageSizeKey = hasOwnKey(body, REQUEST_BODY_PAGE_SIZE_KEYS);
  if (pageSizeKey && (body[pageSizeKey] == null || body[pageSizeKey] === '')) {
    body[pageSizeKey] = DEFAULT_API_REQUEST_PAGE_SIZE;
    return body;
  }
  if (pageNoKey && !pageSizeKey) {
    body.pageSize = DEFAULT_API_REQUEST_PAGE_SIZE;
  }
  return body;
}

/** Body / 响应 JSON 字段：表单值 → API 对象 */
export function normalizeApiJsonObject(value: unknown): Record<string, unknown> {
  const normalized = normalizeJsonFieldValue(value);
  if (isEmptyJsonValue(normalized)) return {};
  if (typeof normalized === 'object' && normalized !== null && !Array.isArray(normalized)) {
    return normalized as Record<string, unknown>;
  }
  return {};
}

export interface ApiFormRawValues {
  name: string;
  code: string;
  description?: string;
  connection_uuid?: string;
  category_uuid?: string;
  path: string;
  method: string;
  sync_direction?: 'pull' | 'push' | 'bidirectional';
  is_active?: boolean;
  is_system?: boolean;
  request_headers?: ApiKeyValueRow[];
  request_params?: ApiKeyValueRow[];
  request_body?: unknown;
  response_format?: unknown;
  response_example?: unknown;
  source_type_conversion_map_entries?: Array<{
    field_name?: string;
    source?: string;
    target?: string;
  }>;
}

export interface ApiFormSubmitValues {
  name: string;
  code: string;
  description?: string;
  connection_uuid?: string | null;
  category_uuid?: string | null;
  path: string;
  method: string;
  sync_direction: 'pull' | 'push' | 'bidirectional';
  is_active?: boolean;
  is_system?: boolean;
  request_headers: Record<string, unknown>;
  request_params: Record<string, unknown>;
  request_body: Record<string, unknown>;
  response_format: Record<string, unknown>;
  response_example: Record<string, unknown>;
  source_type_conversion_map?: Array<{ field_name: string; mapping: Record<string, string> }> | null;
}

/** 表单原始值 → 提交 API 的结构 */
export function transformApiFormValues(values: ApiFormRawValues): ApiFormSubmitValues {
  return {
    name: values.name,
    code: values.code,
    description: values.description,
    connection_uuid: values.connection_uuid ?? null,
    category_uuid: values.category_uuid ?? null,
    path: values.path,
    method: values.method,
    sync_direction: values.sync_direction || 'pull',
    is_active: values.is_active,
    is_system: values.is_system,
    request_headers: keyValueListToObject(values.request_headers),
    request_params: keyValueListToObject(values.request_params),
    request_body: normalizeApiJsonObject(values.request_body),
    response_format: normalizeApiJsonObject(values.response_format),
    response_example: normalizeApiJsonObject(values.response_example),
    source_type_conversion_map: (() => {
      const entries = values.source_type_conversion_map_entries?.filter(
        (e) => e?.field_name?.trim() && e?.source?.trim() && e?.target?.trim(),
      ) ?? [];
      if (!entries.length) return null;
      const grouped: Record<string, Record<string, string>> = {};
      for (const e of entries) {
        const fieldName = e.field_name!.trim();
        if (!grouped[fieldName]) grouped[fieldName] = {};
        // Accept both half-width and full-width commas commonly used in Chinese input.
        const sources = e.source!.split(/[,，]/).map(s => s.trim()).filter(Boolean);
        const targets = e.target!.split(/[,，]/).map(t => t.trim()).filter(Boolean);
        const len = Math.min(sources.length, targets.length);
        for (let i = 0; i < len; i++) {
          grouped[fieldName][sources[i]] = targets[i];
        }
      }
      return Object.entries(grouped).map(([field_name, mapping]) => ({ field_name, mapping }));
    })(),
  };
}
