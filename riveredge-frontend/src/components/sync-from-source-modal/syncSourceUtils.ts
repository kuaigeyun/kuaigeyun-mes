/** 将数据接口响应体规范化为预览/映射用的行字典列表 */

/** 预览仅用于字段映射与样例核对；正式同步仍走服务端分页全量拉取 */
export const SYNC_PREVIEW_ROW_LIMIT = 50;

const KINGDEE_TARGET_ALIASES: Record<string, string[]> = {
  order_code: ['FBillNo', 'BillNo'],
  order_date: ['FDate'],
  delivery_date: ['FDeliveryDate'],
  customer_code: ['FCustId.FNumber', 'FNumber'],
  customer_name: ['FCustId.FName', 'FName'],
  supplier_code: ['FSupplierId.FNumber', 'FNumber'],
  supplier_name: ['FSupplierId.FName', 'FName'],
  forbid_status: ['FForbidStatus'],
  product_code: ['FMaterialId.FNumber'],
  product_name: ['FMaterialId.FName'],
  quantity: [
    'avbqty',
    'qty',
    'FQty',
    'FPlanQty',
    'entryqty',
    'entryQty',
    'entryentryqty',
    'entrychildnumerator',
    'billentryqty',
    'baseqty',
  ],
  material_code: ['material.number', 'material', 'number'],
  material_name: ['material.name'],
  warehouse_code: ['warehouse.number'],
  warehouse_name: ['warehouse.name'],
  batch_no: ['lotnum', 'lot_number', 'lot.number', 'lotnumber'],
  unit: ['unit.number', 'unit.name', 'baseunit'],
  planned_start_date: ['FPlanStartDate'],
  planned_end_date: ['FPlanFinishDate', 'FPlanEndDate'],
  sales_order_code: ['FSaleOrderNo', 'FSrcBillNo'],
  document_status: ['FDocumentStatus'],
  close_status: ['FCloseStatus'],
  status: ['FStatus', 'FDocumentStatus'],
  base_unit: [
    'baseunit.number',
    'baseunit_number',
    'measureunitid_number',
    'FBaseUnitId.FNumber',
    'FUnitId.FNumber',
  ],
  base_unit_name: [
    'baseunit.name',
    'baseunit_name',
    'measureunitid_name',
    'FBaseUnitId.FName',
    'FUnitId.FName',
  ],
  code: [
    'FNumber',
    'number',
    'measureunitid_number',
    'baseunit.number',
    'baseunit_number',
  ],
  name: [
    'name',
    'FName',
    'measureunitid_name',
    'baseunit.name',
    'baseunit_name',
  ],
  short_name: ['FShortName'],
  main_code: ['number', 'FNumber', 'material.number', 'material_number'],
  specification: [
    'modelnum',
    'model_num',
    'modelnumber',
    'model',
    'modelNum',
    'FSpecification',
    'FMaterialId.FSpecification',
  ],
  group_code: [
    'group_number',
    'group.number',
    'materialgroup_number',
    'materialgroup.number',
    'FMaterialGroup.FNumber',
  ],
  group_name: [
    'group_name',
    'group.name',
    'materialgroup_name',
    'materialgroup.name',
    'FMaterialGroup.FName',
  ],
  parent_code: [
    'parent_parent_number',
    'parent_number',
    'parentid_number',
    'parent.number',
    'FParentId.FNumber',
    'FMaterialGroup.FParentId.FNumber',
    'material_number',
    'materialnumber',
    'materialid_number',
  ],
  component_code: [
    'entrymaterial_number',
    'entrymaterialnumber',
    'entrymaterialid_number',
    'entryentrymaterial_number',
    'entryentrymaterialid_number',
    'billentrymaterial_number',
    'FEntityFMaterialId_FNumber',
  ],
  'item.material_code': ['FMaterialId.FNumber'],
  'item.material_name': ['FMaterialId.FName'],
  'item.material_unit': ['FUnitId.FNumber', 'FBaseUnitId.FNumber'],
  'item.required_quantity': ['FQty'],
  'item.ordered_quantity': ['FQty'],
  'item.unit_price': ['FPrice', 'FTaxPrice'],
  'item.tax_rate': ['FEntryTaxRate'],
  'item.delivery_date': ['FDeliveryDate'],
};

export function extractKingdeeFieldKeys(requestBody?: Record<string, unknown> | null): string[] | undefined {
  if (!requestBody || typeof requestBody !== 'object') return undefined;
  let params: unknown = requestBody.parameters;
  if (Array.isArray(params) && params.length > 0) {
    const first = params[0];
    if (typeof first === 'string') {
      try {
        params = JSON.parse(first);
      } catch {
        return undefined;
      }
    } else if (typeof first === 'object' && first !== null) {
      params = first;
    }
  } else if (typeof params === 'string') {
    try {
      params = JSON.parse(params);
    } catch {
      return undefined;
    }
  }
  if (!params || typeof params !== 'object') return undefined;
  const fieldKeys =
    (params as Record<string, unknown>).FieldKeys ?? (params as Record<string, unknown>).fieldKeys;
  if (!fieldKeys) return undefined;
  return String(fieldKeys)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * 预览时压低金蝶 ExecuteBillQuery 的 Limit，避免一次拉 2000 行进弹窗。
 * 浅拷贝 body 并重写 parameters[0] 内 Limit/StartRow；无法解析时原样返回供调用方兜底 slice。
 */
export function withKingdeePreviewLimit(
  requestBody: Record<string, unknown> | null | undefined,
  limit: number = SYNC_PREVIEW_ROW_LIMIT,
): Record<string, unknown> | undefined {
  if (!requestBody || typeof requestBody !== 'object') return undefined;
  const cloned = structuredClone(requestBody) as Record<string, unknown>;
  const params = cloned.parameters;
  if (!Array.isArray(params) || params.length === 0) return cloned;

  let query: Record<string, unknown>;
  const first = params[0];
  if (typeof first === 'string') {
    try {
      query = JSON.parse(first) as Record<string, unknown>;
    } catch {
      return cloned;
    }
  } else if (typeof first === 'object' && first !== null) {
    query = { ...(first as Record<string, unknown>) };
  } else {
    return cloned;
  }

  query.Limit = limit;
  query.StartRow = 0;
  params[0] = JSON.stringify(query);
  cloned.parameters = params;
  return cloned;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 业务明细数组（勿含 data/items/rows 等响应外壳键） */
const NESTED_DETAIL_KEYS = [
  'entry',
  'billentry',
  'BillEntry',
  'FEntity',
  'fentity',
  'TreeEntity',
  'treeEntity',
] as const;

function flattenSyncFields(
  obj: Record<string, unknown>,
  prefix = '',
  glueFirst = true,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [rawKey, value] of Object.entries(obj)) {
    if (!rawKey) continue;
    let full: string;
    if (prefix) {
      if (glueFirst && rawKey.toLowerCase().startsWith(prefix.toLowerCase())) {
        full = rawKey;
      } else if (glueFirst) {
        full = `${prefix}${rawKey}`;
      } else {
        full = `${prefix}_${rawKey}`;
      }
    } else {
      full = rawKey;
    }
    if (isPlainObject(value)) {
      Object.assign(out, flattenSyncFields(value, full, false));
      continue;
    }
    if (Array.isArray(value)) continue;
    out[full] = value;
  }
  return out;
}

function findDetailKey(row: Record<string, unknown>): string | null {
  for (const key of NESTED_DETAIL_KEYS) {
    if (Array.isArray(row[key])) return key;
  }
  const lowerMap = new Map(Object.keys(row).map((k) => [k.toLowerCase(), k]));
  for (const key of NESTED_DETAIL_KEYS) {
    const found = lowerMap.get(key.toLowerCase());
    if (found && Array.isArray(row[found])) return found;
  }
  return null;
}

/** 表头 + entry[] / FEntity[] 摊成扁平行（对齐后端 sync_nested_expand） */
export function expandNestedDetailRows(
  rows: Record<string, unknown>[],
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const row of rows) {
    if (!isPlainObject(row)) continue;
    const detailKey = findDetailKey(row);
    if (!detailKey) {
      out.push(flattenSyncFields(row));
      continue;
    }
    const details = row[detailKey];
    const header: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (k !== detailKey) header[k] = v;
    }
    const flatHeader = flattenSyncFields(header);
    if (!Array.isArray(details) || details.length === 0) {
      out.push(flatHeader);
      continue;
    }
    let expanded = 0;
    for (const item of details) {
      if (!isPlainObject(item)) continue;
      out.push({ ...flatHeader, ...flattenSyncFields(item, detailKey, true) });
      expanded += 1;
    }
    if (expanded === 0) out.push(flatHeader);
  }
  return out;
}

export function collectRowColumnKeys(rows: Record<string, unknown>[]): string[] {
  const seen = new Set<string>();
  const columns: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!key || seen.has(key)) continue;
      seen.add(key);
      columns.push(key);
    }
  }
  return columns;
}

/** 物料行按基础单位编码去重，供单位同步预览/映射 */
export function collapseMaterialRowsToUniqueUnits(
  rows: Record<string, unknown>[],
): Record<string, unknown>[] {
  const seen = new Set<string>();
  const out: Record<string, unknown>[] = [];
  for (const row of rows) {
    const code = String(
      row.baseunit_number ??
        row['baseunit.number'] ??
        row.measureunitid_number ??
        row['measureunitid.number'] ??
        '',
    ).trim();
    const name = String(
      row.baseunit_name ??
        row['baseunit.name'] ??
        row.measureunitid_name ??
        row['measureunitid.name'] ??
        code,
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
      code,
    });
  }
  return out.length ? out : rows;
}

/** 预览只保留映射相关列，避免苍穹 batchQuery 默认全量字段刷屏 */
export function filterPreviewColumns(
  columns: string[],
  preferredKeys?: string[] | null,
  mappedSources?: string[] | null,
): string[] {
  if (!columns.length) return columns;
  const keep = new Set<string>();
  for (const raw of mappedSources || []) {
    const key = String(raw || '').trim();
    if (key && columns.includes(key)) keep.add(key);
  }
  const preferred = (preferredKeys || []).map((item) => String(item || '').trim()).filter(Boolean);
  if (preferred.length) {
    const preferredLower = preferred.map((item) => item.toLowerCase());
    for (const column of columns) {
      const lower = column.toLowerCase();
      if (
        preferredLower.some(
          (key) => lower === key || lower.endsWith(`.${key}`) || lower.includes(key.replace(/\./g, '_')),
        )
      ) {
        keep.add(column);
      }
    }
  }
  if (!keep.size) return columns;
  const ordered = columns.filter((column) => keep.has(column));
  return ordered.length ? ordered : columns;
}

/** 与接口测试预览一致：解包 data.rows / items / records 等嵌套数组。 */
function extractArrayFromObject(body: Record<string, unknown>, depth = 0): unknown[] | null {
  const candidates = ['data', 'items', 'rows', 'records', 'Results', 'result', 'list'];
  for (const key of candidates) {
    const value = body[key];
    if (Array.isArray(value)) {
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

function normalizeApiBodyToRowsRaw(
  body: unknown,
  columnNames?: string[],
): Record<string, unknown>[] {
  const normalized = normalizeBodyValue(body);
  if (normalized == null) return [];
  if (isPlainObject(normalized) && 'error' in normalized) {
    throw new Error(String(normalized.error));
  }
  if (Array.isArray(normalized)) {
    if (normalized.length === 0) return [];
    const first = normalized[0];
    if (Array.isArray(first)) {
      const cols = columnNames?.length ? columnNames : first.map((_, index) => `col_${index}`);
      return normalized
        .filter((row): row is unknown[] => Array.isArray(row))
        .map((row) => {
          const padded = [...row, ...Array(Math.max(0, cols.length - row.length)).fill(null)];
          return Object.fromEntries(cols.map((col, index) => [col, padded[index]]));
        });
    }
    if (typeof first === 'object' && first !== null) {
      return normalized.filter(
        (row): row is Record<string, unknown> => typeof row === 'object' && row !== null,
      );
    }
    return normalized.map((value) => ({ value }));
  }
  if (isPlainObject(normalized)) {
    const nested = extractArrayFromObject(normalized);
    if (nested) {
      return normalizeApiBodyToRowsRaw(nested, columnNames);
    }
    return [normalized];
  }
  return [{ value: normalized }];
}

export function normalizeApiBodyToRows(
  body: unknown,
  columnNames?: string[],
): Record<string, unknown>[] {
  return expandNestedDetailRows(normalizeApiBodyToRowsRaw(body, columnNames));
}

const CAMEL_SNAKE_PAIRS: Array<[string, string]> = [
  ['order_code', 'orderCode'],
  ['order_date', 'orderDate'],
  ['delivery_date', 'deliveryDate'],
  ['customer_id', 'customerId'],
  ['customer_code', 'customerCode'],
  ['customer_name', 'customerName'],
  ['supplier_code', 'supplierCode'],
  ['supplier_name', 'supplierName'],
  ['forbid_status', 'forbidStatus'],
  ['product_code', 'productCode'],
  ['product_name', 'productName'],
  ['quantity', 'quantity'],
  ['planned_start_date', 'plannedStartDate'],
  ['planned_end_date', 'plannedEndDate'],
  ['sales_order_code', 'salesOrderCode'],
  ['document_status', 'documentStatus'],
  ['close_status', 'closeStatus'],
  ['material_code', 'materialCode'],
  ['material_name', 'materialName'],
  ['main_code', 'mainCode'],
  ['base_unit', 'baseUnit'],
  ['base_unit_name', 'baseUnitName'],
  ['group_code', 'groupCode'],
  ['group_name', 'groupName'],
  ['parent_code', 'parentCode'],
  ['material_unit', 'materialUnit'],
  ['required_quantity', 'requiredQuantity'],
  ['unit_price', 'unitPrice'],
  ['salesman_name', 'salesmanName'],
  ['contact_person', 'contactPerson'],
  ['short_name', 'shortName'],
];

function resolveTargetAliases(
  target: string,
  targetAliases?: Record<string, string[]> | null,
): string[] {
  if (targetAliases && Object.prototype.hasOwnProperty.call(targetAliases, target)) {
    return targetAliases[target] ?? [];
  }
  return KINGDEE_TARGET_ALIASES[target] ?? [];
}

function columnMatchesTarget(
  column: string,
  target: string,
  targetAliases?: Record<string, string[]> | null,
): boolean {
  const col = column.trim();
  const tgt = target.trim();
  if (!col || !tgt) return false;
  if (col === tgt) return true;
  const aliases = resolveTargetAliases(tgt, targetAliases);
  if (aliases.includes(col)) return true;
  const colLower = col.toLowerCase();
  const tgtLower = tgt.replace(/^item\./, '').toLowerCase();
  if (colLower === tgtLower) return true;
  if (colLower.endsWith(`.${tgtLower}`)) return true;
  for (const alias of aliases) {
    if (col === alias || colLower === alias.toLowerCase()) return true;
  }
  for (const [snake, camel] of CAMEL_SNAKE_PAIRS) {
    if (tgt === snake && (col === camel || colLower === camel.toLowerCase())) return true;
    if (tgt === camel && (col === snake || colLower === snake)) return true;
    if (tgt.endsWith(snake) && col.endsWith(camel)) return true;
  }
  return false;
}

export function suggestTargetToSourceMapping(
  columns: string[],
  targetFields: string[],
  targetAliases?: Record<string, string[]> | null,
): Record<string, string> {
  const mapping: Record<string, string> = {};
  const columnByLower = new Map(columns.map((column) => [column.toLowerCase(), column]));
  for (const target of targetFields) {
    // 优先同名列（苍穹 name→物料名称），避免被 baseunit_name 等别名抢先
    let hit = columnByLower.get(target.toLowerCase());
    if (!hit) {
      for (const alias of resolveTargetAliases(target, targetAliases)) {
        hit = columnByLower.get(alias.toLowerCase());
        if (hit) break;
      }
    }
    if (!hit) {
      hit = columns.find((column) =>
        columnMatchesTarget(column, target, targetAliases),
      );
    }
    if (hit) mapping[target] = hit;
  }
  return mapping;
}

/** 丢弃来源列已不在预览中的映射，再用建议补齐空目标 */
export function mergeSuggestedMapping(
  columns: string[],
  targetFields: string[],
  existing: Record<string, string>,
  targetAliases?: Record<string, string[]> | null,
): Record<string, string> {
  const suggested = suggestTargetToSourceMapping(columns, targetFields, targetAliases);
  const columnSet = new Set(columns);
  const next: Record<string, string> = { ...suggested };
  for (const [target, source] of Object.entries(existing)) {
    if (!target || !source) continue;
    if (columnSet.size === 0 || columnSet.has(source)) {
      next[target] = source;
    }
  }
  return next;
}

export function invertFieldMapping(targetToSource: Record<string, string>): Record<string, string> {
  const inverted: Record<string, string> = {};
  for (const [target, source] of Object.entries(targetToSource)) {
    if (source && target) inverted[source] = target;
  }
  return inverted;
}

/** 连接器/接口停用属配置态，按普通提示处理，不走危险错误样式 */
export function isInactiveSyncSourceError(error: unknown): boolean {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';
  return /已停用/.test(raw);
}

export function formatSyncErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === 'string' && error.trim()) return error.trim();
  return fallback;
}

export function mappingFromBinding(
  columns: string[],
  bindingMapping: Record<string, string>,
): Record<string, string> {
  const ui: Record<string, string> = {};
  const hasColumns = columns.length > 0;
  for (const [source, target] of Object.entries(bindingMapping)) {
    if (!source || !target) continue;
    // 无预览列时仍恢复绑定，再次同步无需重新映射
    if (!hasColumns || columns.includes(source)) {
      ui[String(target)] = String(source);
    }
  }
  return ui;
}
