/**
 * 关联单号全局约定（唯一挂链路径）。
 * - 普通列：UniTable / 详情 Descriptions 按 dataIndex 自动挂链（列无自定义 render）。
 * - 叠列次行：UniTableStackedPrimaryCell 传入 record 后按 *_code + *_id 自动挂链。
 * 已有叠列主行 render 不得被 UniTable 覆盖。页面特殊 UI 可设 skipLinkedDocumentLink。
 */

import type { LinkedDocumentType } from './linkedDocumentDetail';
import { canOpenLinkedDocumentDetail, normalizeLinkedDocumentType } from './linkedDocumentDetail';

export type LinkedCodeBinding = {
  /** 固定类型，或 from_source_type 读 record.source_type */
  documentType: LinkedDocumentType | 'from_source_type';
  idField: string;
  codeField: string;
};

export function toSnakeField(key: string): string {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/-/g, '_')
    .toLowerCase();
}

export function toCamelField(snake: string): string {
  return snake.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function pickRecordValue(record: Record<string, unknown>, field: string): unknown {
  const snake = toSnakeField(field);
  const camel = toCamelField(snake);
  for (const k of [field, snake, camel]) {
    if (!k) continue;
    const v = record[k];
    if (v != null && String(v).trim() !== '') return v;
  }
  return undefined;
}

/** 前缀 → 单据类型（original_work_order_code → work_order） */
const PREFIX_TO_DOCUMENT_TYPE: Record<string, LinkedDocumentType> = {
  work_order: 'work_order',
  original_work_order: 'work_order',
  source_work_order: 'work_order',
  related_work_order: 'work_order',
  parent_work_order: 'work_order',
  sales_order: 'sales_order',
  original_sales_order: 'sales_order',
  related_sales_order: 'sales_order',
  purchase_order: 'purchase_order',
  related_purchase_order: 'purchase_order',
  purchase_requisition: 'purchase_requisition',
  requisition: 'purchase_requisition',
  demand_computation: 'demand_computation',
  computation: 'demand_computation',
  sales_forecast: 'sales_forecast',
  forecast: 'sales_forecast',
  sales_delivery: 'sales_delivery',
  purchase_receipt: 'purchase_receipt',
  quotation: 'quotation',
  demand: 'demand',
  related_demand: 'demand',
  freight_order: 'freight_order',
  after_sales_ticket: 'after_sales_ticket',
  install_execution: 'install_execution',
  service_asset: 'service_asset',
  repair_order: 'repair_order',
  service_dispatch: 'service_dispatch',
  spare_part_requisition: 'spare_part_requisition',
  service_settlement: 'service_settlement',
  customer_return_visit: 'customer_return_visit',
};

/** 显式 dataIndex 绑定（含 source_code 三元组） */
const EXPLICIT_BINDINGS: Record<string, Omit<LinkedCodeBinding, 'codeField'>> = {
  source_code: { documentType: 'from_source_type', idField: 'source_id' },
  original_work_order_code: { documentType: 'work_order', idField: 'original_work_order_id' },
  work_order_code: { documentType: 'work_order', idField: 'work_order_id' },
  sales_order_code: { documentType: 'sales_order', idField: 'sales_order_id' },
  source_order_code: { documentType: 'sales_order', idField: 'source_order_id' },
  purchase_order_code: { documentType: 'purchase_order', idField: 'purchase_order_id' },
  purchase_requisition_code: {
    documentType: 'purchase_requisition',
    idField: 'purchase_requisition_id',
  },
  requisition_code: { documentType: 'purchase_requisition', idField: 'requisition_id' },
  quotation_code: { documentType: 'quotation', idField: 'quotation_id' },
  computation_code: { documentType: 'demand_computation', idField: 'computation_id' },
  demand_code: { documentType: 'demand', idField: 'demand_id' },
  demand_computation_code: {
    documentType: 'demand_computation',
    idField: 'demand_computation_id',
  },
  forecast_code: { documentType: 'sales_forecast', idField: 'forecast_id' },
  sales_forecast_code: { documentType: 'sales_forecast', idField: 'sales_forecast_id' },
  sales_delivery_code: { documentType: 'sales_delivery', idField: 'sales_delivery_id' },
  purchase_receipt_code: { documentType: 'purchase_receipt', idField: 'purchase_receipt_id' },
  related_demand_code: { documentType: 'demand', idField: 'related_demand_id' },
  freight_order_code: { documentType: 'freight_order', idField: 'freight_order_id' },
  after_sales_ticket_code: { documentType: 'after_sales_ticket', idField: 'after_sales_ticket_id' },
  service_asset_code: { documentType: 'service_asset', idField: 'service_asset_id' },
  install_execution_code: { documentType: 'install_execution', idField: 'install_execution_id' },
  repair_order_code: { documentType: 'repair_order', idField: 'repair_order_id' },
};

/** 列已有自定义 render 时不得覆盖（报价单等主从叠列用 quotation_code 作 dataIndex）。 */
export function shouldInjectLinkedDocumentRender(col: {
  skipLinkedDocumentLink?: boolean;
  render?: unknown;
  dataIndex?: unknown;
  hideInTable?: boolean;
}): boolean {
  if (col.skipLinkedDocumentLink || col.hideInTable) return false;
  if (typeof col.render === 'function') return false;
  return typeof col.dataIndex === 'string' && resolveLinkedDocumentColumn(col.dataIndex) != null;
}

export function resolveLinkedDocumentColumn(dataIndex: string | null | undefined): LinkedCodeBinding | null {
  const raw = String(dataIndex ?? '').trim();
  if (!raw) return null;
  const key = toSnakeField(raw);

  const explicit = EXPLICIT_BINDINGS[raw] ?? EXPLICIT_BINDINGS[key];
  if (explicit) {
    return { ...explicit, codeField: key };
  }

  if (!key.endsWith('_code')) return null;
  const prefix = key.slice(0, -'_code'.length);
  if (!prefix || prefix === 'source') return null;

  const documentType = PREFIX_TO_DOCUMENT_TYPE[prefix];
  if (!documentType) return null;

  return {
    documentType,
    idField: `${prefix}_id`,
    codeField: key,
  };
}

export function resolveLinkedDocumentFromRecord(
  binding: LinkedCodeBinding,
  record: Record<string, unknown> | null | undefined,
): { documentType: string; documentId: number; code: string } | null {
  if (!record) return null;
  const code = String(pickRecordValue(record, binding.codeField) ?? '').trim();
  if (!code) return null;

  const idRaw = pickRecordValue(record, binding.idField);
  const documentId = Number(idRaw);
  if (!Number.isFinite(documentId) || documentId <= 0) return null;

  let documentType =
    binding.documentType === 'from_source_type'
      ? normalizeLinkedDocumentType(String(pickRecordValue(record, 'source_type') ?? ''))
      : binding.documentType;

  documentType = normalizeLinkedDocumentType(documentType);
  if (!documentType || !canOpenLinkedDocumentDetail(documentType)) return null;

  return { documentType, documentId, code };
}

/**
 * 叠列次行：用 secondaryKeys 或 record 上与次行文案相同的 *_code 解析关联抽屉。
 * 次行不是约定单号（物料编码、时间、未登记类型）时返回 null。
 */
export function resolveStackedSecondaryLinkedDocument(
  record: Record<string, unknown> | null | undefined,
  secondaryText: string,
  secondaryKeys?: string[],
): { documentType: string; documentId: number; code: string } | null {
  if (!record) return null;
  const text = String(secondaryText ?? '').trim();
  if (!text || text === '-') return null;

  const keysToTry: string[] = [];
  const seen = new Set<string>();
  const pushKey = (raw: string) => {
    const snake = toSnakeField(raw);
    if (!snake || seen.has(snake)) return;
    seen.add(snake);
    keysToTry.push(snake);
  };
  for (const k of secondaryKeys ?? []) pushKey(k);
  for (const k of Object.keys(record)) {
    if (toSnakeField(k).endsWith('_code')) pushKey(k);
  }

  for (const key of keysToTry) {
    const binding = resolveLinkedDocumentColumn(key);
    if (!binding) continue;
    const resolved = resolveLinkedDocumentFromRecord(binding, record);
    if (!resolved) continue;
    if (resolved.code === text) return resolved;
  }
  return null;
}
