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
  is_active?: boolean;
  is_system?: boolean;
  request_headers?: ApiKeyValueRow[];
  request_params?: ApiKeyValueRow[];
  request_body?: unknown;
  response_format?: unknown;
  response_example?: unknown;
}

export interface ApiFormSubmitValues {
  name: string;
  code: string;
  description?: string;
  connection_uuid?: string | null;
  category_uuid?: string | null;
  path: string;
  method: string;
  is_active?: boolean;
  is_system?: boolean;
  request_headers: Record<string, unknown>;
  request_params: Record<string, unknown>;
  request_body: Record<string, unknown>;
  response_format: Record<string, unknown>;
  response_example: Record<string, unknown>;
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
    is_active: values.is_active,
    is_system: values.is_system,
    request_headers: keyValueListToObject(values.request_headers),
    request_params: keyValueListToObject(values.request_params),
    request_body: normalizeApiJsonObject(values.request_body),
    response_format: normalizeApiJsonObject(values.response_format),
    response_example: normalizeApiJsonObject(values.response_example),
  };
}
