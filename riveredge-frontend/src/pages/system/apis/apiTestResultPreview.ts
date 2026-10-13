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

function extractArrayFromObject(body: Record<string, unknown>, depth = 0): unknown[] | null {
  const candidates = ['data', 'items', 'rows', 'records', 'Results', 'result', 'list'];
  for (const key of candidates) {
    const value = body[key];
    if (Array.isArray(value) && value.length > 0) {
      return value;
    }
  }
  if (depth >= 2) {
    return null;
  }
  for (const key of candidates) {
    const value = body[key];
    if (isPlainObject(value)) {
      const nested = extractArrayFromObject(value, depth + 1);
      if (nested) {
        return nested;
      }
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

/** Table 单元格只能渲染原始值；嵌套对象/数组需序列化，否则 React 会报 invalid child。 */
function formatCellValue(value: unknown): string | number | boolean {
  if (value == null) {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildRowsFromMatrix(rows: unknown[][], headers: string[]): ApiTestTablePreview {
  const columns = buildColumns(headers);
  const dataSource = rows.map((row, rowIndex) => {
    const record: Record<string, unknown> = { key: String(rowIndex) };
    columns.forEach((column, columnIndex) => {
      const cell = Array.isArray(row) ? row[columnIndex] : undefined;
      record[column.dataIndex] = formatCellValue(cell);
    });
    return record;
  });
  return { columns, dataSource };
}

function resolveHintedObjectFields(allFields: string[], fieldKeyHint?: string[]): string[] {
  if (!fieldKeyHint?.length) {
    return allFields;
  }
  const lowerMap = new Map(allFields.map((field) => [field.toLowerCase(), field]));
  const ordered: string[] = [];
  const push = (field: string) => {
    if (!ordered.includes(field)) ordered.push(field);
  };
  for (const raw of fieldKeyHint) {
    const key = String(raw || '').trim();
    if (!key) continue;
    const variants = [key, key.replace(/\./g, '_'), key.includes('.') ? key.split('.').pop() || '' : ''];
    let hit = false;
    for (const variant of variants) {
      if (!variant) continue;
      const exact = lowerMap.get(variant.toLowerCase());
      if (exact) {
        push(exact);
        hit = true;
        break;
      }
    }
    if (!hit) {
      const needle = key.toLowerCase().replace(/\./g, '_');
      for (const field of allFields) {
        const lower = field.toLowerCase();
        if (lower === needle || lower.endsWith(`_${needle}`) || lower.endsWith(`.${key.toLowerCase()}`)) {
          push(field);
          hit = true;
        }
      }
    }
  }
  return ordered.length ? ordered : allFields;
}

function buildRowsFromObjects(
  rows: Record<string, unknown>[],
  fieldKeyHint?: string[],
): ApiTestTablePreview {
  const fieldSet = new Set<string>();
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => fieldSet.add(key));
  });
  const fields = resolveHintedObjectFields([...fieldSet], fieldKeyHint);
  const columns: ApiTestTableColumn[] = fields.map((field) => ({
    title: field,
    dataIndex: field,
    key: field,
    ellipsis: true,
  }));
  const dataSource = rows.map((row, index) => {
    const record: Record<string, unknown> = { key: String(row.key ?? index) };
    fields.forEach((field) => {
      record[field] = formatCellValue(row[field]);
    });
    return record;
  });
  return { columns, dataSource };
}

function buildFromArray(
  rows: unknown[],
  fieldKeyHint?: string[],
  options?: { collapseToUnits?: boolean },
): ApiTestTablePreview | null {
  const collapseToUnits = Boolean(options?.collapseToUnits);
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
    let objectRows = rows as Record<string, unknown>[];
    // 仅单位同步测试（body 带 _unit_sync_test）才去重成单位。
    // 物料查询 select 也含 baseunit.*，绝不能按 hint 误折叠成 kg/KG。
    if (collapseToUnits) {
      objectRows = collapseMaterialRowsToUniqueUnitsForPreview(objectRows);
    }
    return buildRowsFromObjects(objectRows, fieldKeyHint);
  }

  return null;
}

function collapseMaterialRowsToUniqueUnitsForPreview(
  rows: Record<string, unknown>[],
): Record<string, unknown>[] {
  const seen = new Set<string>();
  const out: Record<string, unknown>[] = [];
  for (const row of rows) {
    const code = String(
      row.baseunit_number ??
        row['baseunit.number'] ??
        row.measureunitid_number ??
        '',
    ).trim();
    const name = String(
      row.baseunit_name ?? row['baseunit.name'] ?? row.measureunitid_name ?? code,
    ).trim();
    if (!code) continue;
    const key = code.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      baseunit_number: code,
      baseunit_name: name || code,
      number: code,
      name: name || code,
    });
  }
  return out.length ? out : rows;
}

function splitSelectKeys(raw: unknown): string[] | null {
  if (typeof raw !== 'string' || !raw.trim()) {
    return null;
  }
  const keys = raw
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);
  return keys.length ? keys : null;
}

/** 从测试请求 JSON 解析星空 FieldKeys 或苍穹 select。 */
export function extractKingdeeFieldKeys(testRequestJson: string): string[] | null {
  try {
    const request = JSON.parse(testRequestJson) as {
      body?: Record<string, unknown>;
      params?: Record<string, unknown>;
    };
    const body = request?.body;
    if (body && typeof body === 'object') {
      const fromBodySelect = splitSelectKeys(body.select);
      if (fromBodySelect) return fromBodySelect;
      const data = body.data;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const fromDataSelect = splitSelectKeys((data as Record<string, unknown>).select);
        if (fromDataSelect) return fromDataSelect;
      }
      const parameters = body.parameters;
      if (Array.isArray(parameters) && parameters.length > 0) {
        const queryText = parameters[0];
        if (typeof queryText === 'string' && queryText.trim()) {
          const query = JSON.parse(queryText) as { FieldKeys?: string; fieldKeys?: string };
          const fromFieldKeys = splitSelectKeys(query?.FieldKeys ?? query?.fieldKeys);
          if (fromFieldKeys) return fromFieldKeys;
        }
      }
    }
    const fromParams = splitSelectKeys(request?.params?.select);
    if (fromParams) return fromParams;
    return null;
  } catch {
    return null;
  }
}

export function buildApiTestBodyTablePreview(
  body: unknown,
  fieldKeyHint?: string[] | null,
): ApiTestTablePreview | null {
  const normalized = normalizeBodyValue(body);
  const collapseToUnits =
    isPlainObject(normalized) && Boolean((normalized as Record<string, unknown>)._unit_sync_test);
  if (Array.isArray(normalized)) {
    return buildFromArray(normalized, fieldKeyHint ?? undefined, { collapseToUnits: false });
  }
  if (isPlainObject(normalized)) {
    const nestedRows = extractArrayFromObject(normalized);
    if (nestedRows) {
      return buildFromArray(nestedRows, fieldKeyHint ?? undefined, { collapseToUnits });
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
