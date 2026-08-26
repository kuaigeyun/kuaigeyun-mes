/**
 * 接口测试响应体表格预览：数组对象、数组数组（金蝶 ExecuteBillQuery）等。
 */

export interface ApiTestTableColumn {
  title: string;
  dataIndex: string;
  key: string;
  ellipsis: boolean;
}

export interface ApiTestTablePreview {
  columns: ApiTestTableColumn[];
  dataSource: Record<string, unknown>[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeBodyValue(body: unknown): unknown {
  if (typeof body !== 'string') {
    return body;
  }
  const trimmed = body.trim();
  if (!trimmed) {
    return body;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return body;
  }
}

function extractArrayFromObject(body: Record<string, unknown>): unknown[] | null {
  const candidates = ['data', 'items', 'rows', 'records', 'Results', 'result', 'list'];
  for (const key of candidates) {
    const value = body[key];
    if (Array.isArray(value) && value.length > 0) {
      return value;
    }
  }
  return null;
}

function buildColumns(headers: string[]): ApiTestTableColumn[] {
  return headers.map((title, index) => ({
    title: title || `列${index + 1}`,
    dataIndex: `c${index}`,
    key: `c${index}`,
    ellipsis: true,
  }));
}

function buildRowsFromMatrix(rows: unknown[][], headers: string[]): ApiTestTablePreview {
  const columns = buildColumns(headers);
  const dataSource = rows.map((row, rowIndex) => {
    const record: Record<string, unknown> = { key: String(rowIndex) };
    columns.forEach((column, columnIndex) => {
      const cell = Array.isArray(row) ? row[columnIndex] : undefined;
      record[column.dataIndex] = cell ?? '';
    });
    return record;
  });
  return { columns, dataSource };
}

function buildRowsFromObjects(rows: Record<string, unknown>[]): ApiTestTablePreview {
  const fieldSet = new Set<string>();
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => fieldSet.add(key));
  });
  const fields = [...fieldSet];
  const columns: ApiTestTableColumn[] = fields.map((field) => ({
    title: field,
    dataIndex: field,
    key: field,
    ellipsis: true,
  }));
  const dataSource = rows.map((row, index) => ({
    key: String(row.key ?? index),
    ...row,
  }));
  return { columns, dataSource };
}

function buildFromArray(rows: unknown[], fieldKeyHint?: string[]): ApiTestTablePreview | null {
  if (rows.length === 0) {
    return null;
  }

  if (rows.every((row) => Array.isArray(row))) {
    const matrix = rows as unknown[][];
    const width = matrix.reduce((max, row) => Math.max(max, row.length), 0);
    const headers =
      fieldKeyHint && fieldKeyHint.length >= width
        ? fieldKeyHint.slice(0, width)
        : Array.from({ length: width }, (_, index) => `列${index + 1}`);
    return buildRowsFromMatrix(matrix, headers);
  }

  if (rows.every((row) => isPlainObject(row))) {
    return buildRowsFromObjects(rows as Record<string, unknown>[]);
  }

  return null;
}

/** 从测试请求 JSON 解析金蝶 ExecuteBillQuery 的 FieldKeys。 */
export function extractKingdeeFieldKeys(testRequestJson: string): string[] | null {
  try {
    const request = JSON.parse(testRequestJson) as { body?: { parameters?: unknown[] } };
    const parameters = request?.body?.parameters;
    if (!Array.isArray(parameters) || parameters.length === 0) {
      return null;
    }
    const queryText = parameters[0];
    if (typeof queryText !== 'string' || !queryText.trim()) {
      return null;
    }
    const query = JSON.parse(queryText) as { FieldKeys?: string };
    const fieldKeys = query?.FieldKeys;
    if (typeof fieldKeys !== 'string' || !fieldKeys.trim()) {
      return null;
    }
    return fieldKeys
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean);
  } catch {
    return null;
  }
}

export function buildApiTestBodyTablePreview(
  body: unknown,
  fieldKeyHint?: string[] | null,
): ApiTestTablePreview | null {
  const normalized = normalizeBodyValue(body);
  if (Array.isArray(normalized)) {
    return buildFromArray(normalized, fieldKeyHint ?? undefined);
  }
  if (isPlainObject(normalized)) {
    const nestedRows = extractArrayFromObject(normalized);
    if (nestedRows) {
      return buildFromArray(nestedRows, fieldKeyHint ?? undefined);
    }
  }
  return null;
}

export function formatApiTestBodyJson(body: unknown): string {
  if (typeof body === 'string') {
    const normalized = normalizeBodyValue(body);
    if (normalized !== body) {
      return JSON.stringify(normalized, null, 2);
    }
    return body;
  }
  return JSON.stringify(body, null, 2);
}
