import type { TFunction } from 'i18next';
import type { OperationItem } from '../components/OperationSequenceEditor';
import type { Operation } from '../types/process';
import { displayMinutesToHours, hoursToDisplayMinutes } from './manufacturingTimeUnits';

type SeqInput = unknown;

/** 兼容 JSON 字符串或已解析对象 */
export function normalizeOperationSequenceInput(seq: unknown): unknown {
  if (seq == null) return seq;
  if (typeof seq === 'string') {
    const trimmed = seq.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return null;
    }
  }
  return seq;
}

function toOpItemBase(
  op: {
    uuid: string;
    code?: string;
    name?: string;
    description?: string;
    reportingType?: string;
    reporting_type?: string;
    isNodeOperation?: boolean;
    is_node_operation?: boolean;
    overReportMode?: string;
    over_report_mode?: string;
    overReportValue?: number;
    over_report_value?: number;
    standardTime?: number;
    standard_time?: number;
    setupTime?: number;
    setup_time?: number;
    isOutsourced?: boolean;
    is_outsourced?: boolean;
    outsourceLeadTimeDays?: number;
    outsource_lead_time_days?: number;
    outsourceSupplierId?: number;
    outsource_supplier_id?: number;
    outsourceSupplierName?: string;
    outsource_supplier_name?: string;
  },
  itemOverrides?: Record<string, unknown>,
): OperationItem {
  const merged = { ...op, ...(itemOverrides || {}) } as Record<string, unknown>;
  const isOutsourced = Boolean(
    merged.isOutsourced ?? merged.is_outsourced ?? false,
  );
  const leadRaw = merged.outsourceLeadTimeDays ?? merged.outsource_lead_time_days;
  const supplierIdRaw = merged.outsourceSupplierId ?? merged.outsource_supplier_id;
  const supplierId =
    supplierIdRaw != null && Number(supplierIdRaw) > 0 ? Number(supplierIdRaw) : undefined;
  return {
    uuid: op.uuid,
    code: op.code || '',
    name: op.name || '',
    description: op.description,
    reportingType: (merged.reportingType ??
      merged.reporting_type ??
      'quantity') as 'quantity' | 'status',
    isNodeOperation: Boolean(merged.isNodeOperation ?? merged.is_node_operation ?? false),
    overReportMode: (merged.overReportMode ??
      merged.over_report_mode ??
      'none') as OperationItem['overReportMode'],
    overReportValue:
      Number(merged.overReportValue ?? merged.over_report_value ?? 0) || 0,
    standardTime: hoursToDisplayMinutes(
      Number(merged.standardTime ?? merged.standard_time ?? 0) || undefined,
    ),
    setupTime: hoursToDisplayMinutes(Number(merged.setupTime ?? merged.setup_time ?? 0) || undefined),
    isOutsourced,
    outsourceLeadTimeDays: isOutsourced
      ? Math.max(0, Number(leadRaw ?? 1) || 1)
      : undefined,
    outsourceSupplierId: isOutsourced ? supplierId : undefined,
    outsourceSupplierName: isOutsourced
      ? String(merged.outsourceSupplierName ?? merged.outsource_supplier_name ?? '') || undefined
      : undefined,
  };
}

/** 将工艺路线 operation_sequence 解析为编辑器用的工序列表 */
export async function parseOperationSequenceFromRoute(
  seq: SeqInput,
  t: TFunction,
  loadAllOperations: () => Promise<Operation[]>,
): Promise<OperationItem[]> {
  const normalized = normalizeOperationSequenceInput(seq);
  if (!normalized) return [];
  const allOps = await loadAllOperations();
  let sequenceData: unknown[] = [];

  if (Array.isArray(normalized)) {
    sequenceData = normalized;
  } else if (typeof normalized === 'object' && normalized !== null) {
    const seqObj = normalized as Record<string, unknown>;
    if (Array.isArray(seqObj.operations)) {
      sequenceData = seqObj.operations;
    } else if (Array.isArray(seqObj.sequence)) {
      for (const uuid of seqObj.sequence) {
        const op = allOps.find((o) => o.uuid === uuid);
        if (op) {
          sequenceData.push({
            uuid: op.uuid,
            code: op.code,
            name: op.name,
            description: op.description,
            reportingType: op.reportingType ?? (op as { reporting_type?: string }).reporting_type,
          });
        }
      }
    }
  }

  const ops: OperationItem[] = [];
  for (const item of sequenceData) {
    let opItem: OperationItem | null = null;
    if (typeof item === 'string') {
      const op = allOps.find((o) => o.uuid === item);
      opItem = op
        ? toOpItemBase(op)
        : {
            uuid: item,
            code: item.substring(0, 8),
            name: t('field.route.operationSequence'),
            reportingType: 'quantity',
            isNodeOperation: false,
            overReportMode: 'none',
            overReportValue: 0,
          };
    } else if (item && typeof item === 'object') {
      const row = item as Record<string, unknown>;
      const uuid = String(row.uuid ?? row.operation_uuid ?? '').trim();
      if (!uuid) continue;
      const op = allOps.find((o) => o.uuid === uuid);
      if (op) {
        opItem = toOpItemBase(op, row);
      } else {
        opItem = toOpItemBase(
          {
            uuid,
            code: String(row.code ?? uuid.substring(0, 8)),
            name: String(row.name ?? t('field.route.operationSequence')),
            description: row.description as string | undefined,
          },
          row,
        );
      }
    }
    if (opItem) ops.push(opItem);
  }
  return ops;
}

/** 构建保存到后端的 operation_sequence 载荷 */
export function buildOperationSequencePayload(
  operationSequence: OperationItem[],
  allowOperationJump: boolean,
): { sequence: string[]; operations: Record<string, unknown>[] } {
  return {
    sequence: operationSequence.map((op) => op.uuid),
    operations: operationSequence.map((op) => {
      const row: Record<string, unknown> = {
        uuid: op.uuid,
        code: op.code,
        name: op.name,
        reportingType: op.reportingType ?? 'quantity',
        isNodeOperation: allowOperationJump ? (op.isNodeOperation ?? false) : false,
      };
      const om = op.overReportMode ?? 'none';
      const ov = Number(op.overReportValue) || 0;
      if (om !== 'none' || ov > 0) {
        row.overReportMode = om;
        row.overReportValue = ov;
      }
      const standardHours = displayMinutesToHours(op.standardTime);
      if (standardHours != null) {
        row.standard_time = standardHours;
      }
      const setupHours = displayMinutesToHours(op.setupTime);
      if (setupHours != null) {
        row.setup_time = setupHours;
      }
      if (op.isOutsourced) {
        row.is_outsourced = true;
        row.isOutsourced = true;
        row.outsource_lead_time_days = Math.max(0, Number(op.outsourceLeadTimeDays ?? 1) || 1);
        row.outsourceLeadTimeDays = row.outsource_lead_time_days;
        if (op.outsourceSupplierId != null && op.outsourceSupplierId > 0) {
          row.outsource_supplier_id = op.outsourceSupplierId;
          row.outsourceSupplierId = op.outsourceSupplierId;
        }
        if (op.outsourceSupplierName) {
          row.outsource_supplier_name = op.outsourceSupplierName;
          row.outsourceSupplierName = op.outsourceSupplierName;
        }
      }
      return row;
    }),
  };
}
