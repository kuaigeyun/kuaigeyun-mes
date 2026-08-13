/**
 * 关联单号列全局约定（UniTable / 详情 Descriptions 唯一自动挂链路径）。
 * 列 dataIndex 命中约定、且列没有自定义 render 时，自动渲染可点链接打开嵌套抽屉。
 * 已有叠列 render 不得覆盖。页面特殊 UI 可设 skipLinkedDocumentLink: true 退出。
 */

import type { LinkedDocumentType } from './linkedDocumentDetail';
import { canOpenLinkedDocumentDetail, normalizeLinkedDocumentType } from './linkedDocumentDetail';

export type LinkedCodeBinding = {
  /** 固定类型，或 from_source_type 读 record.source_type */
  documentType: LinkedDocumentType | 'from_source_type';
  idField: string;
  codeField: string;
};

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
};

/** 显式 dataIndex 绑定（含 source_code 三元组） */
const EXPLICIT_BINDINGS: Record<string, Omit<LinkedCodeBinding, 'codeField'>> = {
  source_code: { documentType: 'from_source_type', idField: 'source_id' },
  original_work_order_code: { documentType: 'work_order', idField: 'original_work_order_id' },
  work_order_code: { documentType: 'work_order', idField: 'work_order_id' },
  sales_order_code: { documentType: 'sales_order', idField: 'sales_order_id' },
  purchase_order_code: { documentType: 'purchase_order', idField: 'purchase_order_id' },
  purchase_requisition_code: {
    documentType: 'purchase_requisition',
    idField: 'purchase_requisition_id',
  },
  requisition_code: { documentType: 'purchase_requisition', idField: 'requisition_id' },
  quotation_code: { documentType: 'quotation', idField: 'quotation_id' },
  computation_code: { documentType: 'demand_computation', idField: 'computation_id' },
  demand_computation_code: {
    documentType: 'demand_computation',
    idField: 'demand_computation_id',
  },
  forecast_code: { documentType: 'sales_forecast', idField: 'forecast_id' },
  sales_forecast_code: { documentType: 'sales_forecast', idField: 'sales_forecast_id' },
  sales_delivery_code: { documentType: 'sales_delivery', idField: 'sales_delivery_id' },
  purchase_receipt_code: { documentType: 'purchase_receipt', idField: 'purchase_receipt_id' },
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
  const key = String(dataIndex ?? '').trim();
  if (!key) return null;

  const explicit = EXPLICIT_BINDINGS[key];
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
  const code = String(record[binding.codeField] ?? '').trim();
  if (!code) return null;

  const idRaw = record[binding.idField];
  const documentId = Number(idRaw);
  if (!Number.isFinite(documentId) || documentId <= 0) return null;

  let documentType =
    binding.documentType === 'from_source_type'
      ? normalizeLinkedDocumentType(record.source_type as string)
      : binding.documentType;

  documentType = normalizeLinkedDocumentType(documentType);
  if (!documentType || !canOpenLinkedDocumentDetail(documentType)) return null;

  return { documentType, documentId, code };
}
