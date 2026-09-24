import type { TFunction } from 'i18next';
import type { OperationItem } from '../components/OperationSequenceEditor';
import type { Operation } from '../types/process';
import { displayMinutesToHours, hoursToDisplayMinutes } from './manufacturingTimeUnits';

type SeqInput = unknown;

export type RouteIpqcFields = {
  inspectionMode: 'none' | 'simple' | 'plan';
  inspectionPlanId?: number;
  inspectionPlanName?: string;
  inspectionPlanIds?: number[];
  inspectionPlanNames?: string[];
};

function normalizePlanIdList(raw: unknown): number[] {
  if (raw == null || raw === '') return [];
  const items = Array.isArray(raw) ? raw : [raw];
  const out: number[] = [];
  const seen = new Set<number>();
  for (const item of items) {
    const id = Number(item);
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** 从工序主数据解析过程检验（IPQC）默认值 */
export function ipqcFromOperation(op?: Operation | null): RouteIpqcFields {
  if (!op) {
    return { inspectionMode: 'none', inspectionPlanIds: [] };
  }
  const stages = (op as { inspection_stages?: Record<string, unknown>; inspectionStages?: Record<string, unknown> })
    .inspection_stages
    ?? (op as { inspectionStages?: Record<string, unknown> }).inspectionStages;
  const ipqc = stages && typeof stages === 'object' ? (stages as Record<string, unknown>).ipqc : null;
  if (ipqc && typeof ipqc === 'object') {
    const row = ipqc as Record<string, unknown>;
    const mode = String(row.mode || 'none').toLowerCase() as RouteIpqcFields['inspectionMode'];
    let planIds = normalizePlanIdList(row.plan_ids ?? row.planIds);
    if (!planIds.length) {
      planIds = normalizePlanIdList(row.plan_id ?? row.planId);
    }
    const namesRaw =
      (op as { defaultInspectionPlanNames?: string[] }).defaultInspectionPlanNames
      ?? (op as { default_inspection_plan_names?: string[] }).default_inspection_plan_names
      ?? [];
    const names = Array.isArray(namesRaw)
      ? namesRaw.map((n) => String(n || '').trim()).filter(Boolean)
      : [];
    const name =
      mode === 'plan'
        ? (names[0]
            || String(
                (op as { defaultInspectionPlanName?: string }).defaultInspectionPlanName
                  ?? (op as { default_inspection_plan_name?: string }).default_inspection_plan_name
                  ?? '',
              ).trim() || undefined)
        : undefined;
    return {
      inspectionMode: mode === 'simple' || mode === 'plan' ? mode : 'none',
      inspectionPlanIds: mode === 'plan' ? planIds : [],
      inspectionPlanId: mode === 'plan' ? planIds[0] : undefined,
      inspectionPlanName: name,
      inspectionPlanNames: mode === 'plan' ? (names.length ? names : (name && planIds.length ? [name] : [])) : [],
    };
  }
  const mode = String(
    op.inspectionMode ?? (op as { inspection_mode?: string }).inspection_mode ?? 'none',
  ).toLowerCase() as RouteIpqcFields['inspectionMode'];
  const planRaw =
    (op as { defaultInspectionPlanIds?: number[] }).defaultInspectionPlanIds
    ?? (op as { default_inspection_plan_ids?: number[] }).default_inspection_plan_ids
    ?? op.defaultInspectionPlanId
    ?? (op as { default_inspection_plan_id?: number }).default_inspection_plan_id;
  const planIds = mode === 'plan' ? normalizePlanIdList(planRaw) : [];
  const namesRaw =
    (op as { defaultInspectionPlanNames?: string[] }).defaultInspectionPlanNames
    ?? (op as { default_inspection_plan_names?: string[] }).default_inspection_plan_names
    ?? [];
  const names = Array.isArray(namesRaw)
    ? namesRaw.map((n) => String(n || '').trim()).filter(Boolean)
    : [];
  const name =
    mode === 'plan'
      ? (names[0]
          || String(
              (op as { defaultInspectionPlanName?: string }).defaultInspectionPlanName
                ?? (op as { default_inspection_plan_name?: string }).default_inspection_plan_name
                ?? '',
            ).trim() || undefined)
      : undefined;
  return {
    inspectionMode: mode === 'simple' || mode === 'plan' ? mode : 'none',
    inspectionPlanIds: planIds,
    inspectionPlanId: planIds[0],
    inspectionPlanName: name,
    inspectionPlanNames: names.length ? names : (name && planIds.length ? [name] : []),
  };
}

function ipqcFromMergedRow(
  merged: Record<string, unknown>,
  fallbackOp?: Operation | null,
): RouteIpqcFields {
  const hasExplicit =
    merged.inspectionMode != null
    || merged.inspection_mode != null
    || merged.inspectionPlanId != null
    || merged.inspection_plan_id != null
    || merged.inspectionPlanIds != null
    || merged.inspection_plan_ids != null
    || (merged.inspection_stages != null && typeof merged.inspection_stages === 'object')
    || (merged.inspectionStages != null && typeof merged.inspectionStages === 'object');
  if (!hasExplicit) {
    return ipqcFromOperation(fallbackOp);
  }
  const stages = (merged.inspection_stages ?? merged.inspectionStages) as
    | Record<string, unknown>
    | undefined;
  if (stages && typeof stages === 'object' && stages.ipqc && typeof stages.ipqc === 'object') {
    const row = stages.ipqc as Record<string, unknown>;
    const mode = String(row.mode || 'none').toLowerCase() as RouteIpqcFields['inspectionMode'];
    let planIds = normalizePlanIdList(row.plan_ids ?? row.planIds);
    if (!planIds.length) {
      planIds = normalizePlanIdList(row.plan_id ?? row.planId);
    }
    const namesRaw = merged.inspectionPlanNames ?? merged.inspection_plan_names;
    const names = Array.isArray(namesRaw)
      ? namesRaw.map((n) => String(n).trim()).filter(Boolean)
      : [];
    return {
      inspectionMode: mode === 'simple' || mode === 'plan' ? mode : 'none',
      inspectionPlanIds: mode === 'plan' ? planIds : [],
      inspectionPlanId: mode === 'plan' ? planIds[0] : undefined,
      inspectionPlanName:
        mode === 'plan'
          ? String(merged.inspectionPlanName ?? merged.inspection_plan_name ?? names[0] ?? '').trim()
            || undefined
          : undefined,
      inspectionPlanNames: mode === 'plan' ? names : [],
    };
  }
  const mode = String(
    merged.inspectionMode ?? merged.inspection_mode ?? 'none',
  ).toLowerCase() as RouteIpqcFields['inspectionMode'];
  let planIds = normalizePlanIdList(merged.inspectionPlanIds ?? merged.inspection_plan_ids);
  if (!planIds.length) {
    planIds = normalizePlanIdList(merged.inspectionPlanId ?? merged.inspection_plan_id);
  }
  const namesRaw = merged.inspectionPlanNames ?? merged.inspection_plan_names;
  const names = Array.isArray(namesRaw)
    ? namesRaw.map((n) => String(n).trim()).filter(Boolean)
    : [];
  return {
    inspectionMode: mode === 'simple' || mode === 'plan' ? mode : 'none',
    inspectionPlanIds: mode === 'plan' ? planIds : [],
    inspectionPlanId: mode === 'plan' ? planIds[0] : undefined,
    inspectionPlanName:
      mode === 'plan'
        ? String(merged.inspectionPlanName ?? merged.inspection_plan_name ?? names[0] ?? '').trim()
          || undefined
        : undefined,
    inspectionPlanNames: mode === 'plan' ? names : [],
  };
}

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

function hasRouteIpqcOverride(row?: Record<string, unknown> | null): boolean {
  if (!row || typeof row !== 'object') return false;
  return (
    row.inspectionMode != null
    || row.inspection_mode != null
    || row.inspectionPlanId != null
    || row.inspection_plan_id != null
    || row.inspectionPlanIds != null
    || row.inspection_plan_ids != null
    || (row.inspection_stages != null && typeof row.inspection_stages === 'object')
    || (row.inspectionStages != null && typeof row.inspectionStages === 'object')
  );
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
  masterOp?: Operation | null,
): OperationItem {
  const merged = { ...op, ...(itemOverrides || {}) } as Record<string, unknown>;
  const isOutsourced = Boolean(
    merged.isOutsourced ?? merged.is_outsourced ?? false,
  );
  const leadRaw = merged.outsourceLeadTimeDays ?? merged.outsource_lead_time_days;
  const supplierIdRaw = merged.outsourceSupplierId ?? merged.outsource_supplier_id;
  const supplierId =
    supplierIdRaw != null && Number(supplierIdRaw) > 0 ? Number(supplierIdRaw) : undefined;
  // 路线行覆盖优先：勿把工序主数据的 inspection_stages 并进 merged 后再解析，
  // 否则会盖掉已保存的 inspection_plan_ids（多方案回显失败）。
  const ipqc = hasRouteIpqcOverride(itemOverrides)
    ? ipqcFromMergedRow(itemOverrides as Record<string, unknown>, null)
    : ipqcFromOperation(masterOp ?? null);
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
    inspectionMode: ipqc.inspectionMode,
    inspectionPlanId: ipqc.inspectionPlanId,
    inspectionPlanName: ipqc.inspectionPlanName,
    inspectionPlanIds: ipqc.inspectionPlanIds ?? (ipqc.inspectionPlanId ? [ipqc.inspectionPlanId] : []),
    inspectionPlanNames: ipqc.inspectionPlanNames ?? [],
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
        ? toOpItemBase(op, undefined, op)
        : {
            uuid: item,
            code: item.substring(0, 8),
            name: t('field.route.operationSequence'),
            reportingType: 'quantity',
            isNodeOperation: false,
            overReportMode: 'none',
            overReportValue: 0,
            inspectionMode: 'none',
          };
    } else if (item && typeof item === 'object') {
      const row = item as Record<string, unknown>;
      const uuid = String(row.uuid ?? row.operation_uuid ?? '').trim();
      if (!uuid) continue;
      const op = allOps.find((o) => o.uuid === uuid);
      if (op) {
        opItem = toOpItemBase(op, row, op);
      } else {
        opItem = toOpItemBase(
          {
            uuid,
            code: String(row.code ?? uuid.substring(0, 8)),
            name: String(row.name ?? t('field.route.operationSequence')),
            description: row.description as string | undefined,
          },
          row,
          null,
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
        allowJump: allowOperationJump && !(op.isNodeOperation ?? false),
        allow_jump: allowOperationJump && !(op.isNodeOperation ?? false),
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
      const im = op.inspectionMode ?? 'none';
      row.inspection_mode = im;
      row.inspectionMode = im;
      const planIds =
        im === 'plan'
          ? (op.inspectionPlanIds?.length
              ? op.inspectionPlanIds
              : op.inspectionPlanId != null && op.inspectionPlanId > 0
                ? [op.inspectionPlanId]
                : [])
          : [];
      if (im === 'plan' && planIds.length) {
        row.inspection_plan_ids = planIds;
        row.inspectionPlanIds = planIds;
        row.inspection_plan_id = planIds[0];
        row.inspectionPlanId = planIds[0];
        const names = op.inspectionPlanNames?.length
          ? op.inspectionPlanNames
          : op.inspectionPlanName
            ? [op.inspectionPlanName]
            : [];
        if (names.length) {
          row.inspection_plan_names = names;
          row.inspectionPlanNames = names;
          row.inspection_plan_name = names[0];
          row.inspectionPlanName = names[0];
        }
      }
      return row;
    }),
  };
}
