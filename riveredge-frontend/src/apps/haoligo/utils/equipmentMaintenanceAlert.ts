/**
 * 设备保养计划：保养完修记录 + 依产量/依天数周期（先达到者预警）。
 */
import dayjs from 'dayjs';
import {
  fetchEquipmentMaintenanceReminders,
  fetchMaintenanceUpkeepLastByEquipment,
  listEquipments,
  type EquipmentMaintenanceReminderItem,
  type EquipmentRow,
  type MaintenanceReminderSummary,
} from '../services/haoligo';

export type AlertLevel = 'critical' | 'warning' | 'ok';
export type MaintenanceAlertDimension = 'yield' | 'days';
export type EquipmentMaintenanceReminderKind =
  | 'manual_maintenance'
  | 'cycle_plan'
  | 'setup_no_cycle'
  | 'setup_no_baseline';

export type EquipmentMaintenanceAlertRow = EquipmentRow &
  EquipmentMaintenanceReminderItem;

export const severityRank: Record<AlertLevel, number> = {
  critical: 0,
  warning: 1,
  ok: 2,
};

const KIND_RANK: Record<EquipmentMaintenanceReminderKind, number> = {
  manual_maintenance: 0,
  setup_no_baseline: 1,
  setup_no_cycle: 2,
  cycle_plan: 3,
};

export const WARN_RATIO = 0.9;

export async function fetchAllPaged<T>(
  fetchPage: (skip: number, limit: number) => Promise<{ items: T[]; total: number }>,
  limit = 200,
): Promise<T[]> {
  const out: T[] = [];
  let skip = 0;
  for (let guard = 0; guard < 500; guard++) {
    const r = await fetchPage(skip, limit);
    const batch = r.items ?? [];
    out.push(...batch);
    if (out.length >= r.total || batch.length === 0) break;
    skip += limit;
  }
  return out;
}

function parseDec(s: string | number | null | undefined): number | undefined {
  if (s == null) return undefined;
  const t = String(s).trim();
  if (!t) return undefined;
  const n = Number(t.replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

function parsePositiveInt(v: number | string | null | undefined): number | undefined {
  const n = parseDec(v);
  if (n == null || n <= 0) return undefined;
  return Math.trunc(n);
}

export function hasPositiveUsedYield(usedYield: string | number | null | undefined): boolean {
  const n = parseDec(usedYield);
  return n != null && n > 0;
}

const MANUAL_MAINTENANCE_STATUS_VALUES = new Set(['upkeep', 'maintenance', '保养']);

export function isManualMaintenanceOperationalStatus(
  status: string | null | undefined,
  labelByValue?: Record<string, string>,
): boolean {
  const key = String(status ?? '').trim().toLowerCase();
  if (!key) return false;
  if (MANUAL_MAINTENANCE_STATUS_VALUES.has(key)) return true;
  const label = (labelByValue?.[key] ?? '').trim();
  return label.includes('保养');
}

export function equipmentHasCycle(row: Pick<EquipmentRow, 'maintenance_cycle_by_yield' | 'maintenance_cycle_by_days'>): boolean {
  const cy = parseDec(row.maintenance_cycle_by_yield);
  const cd = parsePositiveInt(row.maintenance_cycle_by_days);
  return (cy != null && cy > 0) || cd != null;
}

export function equipmentNeedsTracking(
  row: Pick<EquipmentRow, 'used_yield' | 'operational_status'>,
): boolean {
  if (hasPositiveUsedYield(row.used_yield)) return true;
  const st = String(row.operational_status ?? '').trim().toLowerCase();
  return ['running', 'repair', 'standby', 'upkeep', 'maintenance', '保养'].includes(st);
}

function normalizeAssetCode(code: string): string {
  return code.trim();
}

function lookupLastUpkeep(map: Map<string, string>, assetCode: string): string | undefined {
  const key = normalizeAssetCode(assetCode);
  if (!key) return undefined;
  const direct = map.get(key);
  if (direct) return direct;
  const lower = key.toLowerCase();
  for (const [k, v] of map) {
    if (k.toLowerCase() === lower) return v;
  }
  return undefined;
}

export async function buildLastUpkeepByEquipment(): Promise<Map<string, string>> {
  const res = await fetchMaintenanceUpkeepLastByEquipment();
  const map = new Map<string, string>();
  for (const [code, at] of Object.entries(res.items ?? {})) {
    const key = normalizeAssetCode(code);
    if (key && at) map.set(key, at);
  }
  return map;
}

function levelFromRatio(ratio: number): AlertLevel {
  if (ratio >= 1) return 'critical';
  if (ratio >= WARN_RATIO) return 'warning';
  return 'ok';
}

function reasonForDimension(dim: MaintenanceAlertDimension, level: AlertLevel): string {
  if (dim === 'yield') {
    if (level === 'critical') return '累计产量已达或超过「依产量」维保周期';
    return '累计产量已接近「依产量」维保周期（≥90%）';
  }
  if (level === 'critical') return '距上次保养已超过「依天数」维保周期';
  return '距上次保养已接近「依天数」维保周期（≥90%）';
}

export function buildManualMaintenanceReminderRow(
  row: EquipmentRow,
  labelByValue?: Record<string, string>,
): EquipmentMaintenanceAlertRow | null {
  if (!isManualMaintenanceOperationalStatus(row.operational_status, labelByValue)) return null;
  return {
    ...row,
    reminder_kind: 'manual_maintenance',
    alert_level: 'warning',
    alert_reasons: ['设备运行状态为保养，请安排保养作业'],
    dominant_dimension: null,
    dominant_ratio: 0,
    last_upkeep_at: null,
  };
}

export function evaluateEquipmentMaintenanceAlert(
  row: EquipmentRow,
  lastUpkeepByEquipment: Map<string, string>,
  labelByValue?: Record<string, string>,
): EquipmentMaintenanceAlertRow | null {
  const acode = normalizeAssetCode(String(row.asset_code || ''));
  if (!acode) return null;

  const manual = buildManualMaintenanceReminderRow(row, labelByValue);
  if (manual) return manual;

  const hasCycle = equipmentHasCycle(row);
  const lastUpkeep = lookupLastUpkeep(lastUpkeepByEquipment, acode);

  if (!hasCycle) {
    if (!equipmentNeedsTracking(row)) return null;
    return {
      ...row,
      reminder_kind: 'setup_no_cycle',
      alert_level: 'warning',
      alert_reasons: ['未配置保养周期（依产量或依天数），请维护设备台账'],
      dominant_dimension: null,
      dominant_ratio: 0,
      last_upkeep_at: lastUpkeep ?? null,
    };
  }

  if (!lastUpkeep) {
    return {
      ...row,
      reminder_kind: 'setup_no_baseline',
      alert_level: 'warning',
      alert_reasons: ['已配置保养周期，但尚无保养完修记录，请完成首次保养并登记完修单'],
      dominant_dimension: null,
      dominant_ratio: 0,
      last_upkeep_at: null,
    };
  }

  const cycleY = parseDec(row.maintenance_cycle_by_yield);
  const usedY = parseDec(row.used_yield ?? '') ?? 0;
  const cycleD = parsePositiveInt(row.maintenance_cycle_by_days);
  const days = dayjs().startOf('day').diff(dayjs(lastUpkeep).startOf('day'), 'day');

  const candidates: {
    dim: MaintenanceAlertDimension;
    ratio: number;
    yieldPct?: number;
    daysSince?: number;
    daysPct?: number;
  }[] = [];

  if (cycleY != null && cycleY > 0 && usedY > 0) {
    candidates.push({
      dim: 'yield',
      ratio: usedY / cycleY,
      yieldPct: Math.round((usedY / cycleY) * 1000) / 10,
    });
  }

  if (cycleD != null) {
    candidates.push({
      dim: 'days',
      ratio: days / cycleD,
      daysSince: days,
      daysPct: Math.round((days / cycleD) * 1000) / 10,
    });
  }

  if (candidates.length === 0) {
    return {
      ...row,
      reminder_kind: 'cycle_plan',
      alert_level: 'ok',
      alert_reasons: [],
      dominant_dimension: null,
      dominant_ratio: 0,
      last_upkeep_at: lastUpkeep,
      days_since_upkeep: days,
    };
  }

  const dominant = candidates.reduce((best, cur) => (cur.ratio > best.ratio ? cur : best));
  const alertLevel = levelFromRatio(dominant.ratio);

  const reasons: string[] = [];
  for (const c of candidates) {
    const lv = levelFromRatio(c.ratio);
    if (lv === 'critical' || lv === 'warning') {
      reasons.push(reasonForDimension(c.dim, lv));
    }
  }

  const yieldCand = candidates.find((c) => c.dim === 'yield');
  const daysCand = candidates.find((c) => c.dim === 'days');
  const remainingDays = cycleD != null ? Math.max(0, cycleD - days) : undefined;

  return {
    ...row,
    reminder_kind: 'cycle_plan',
    alert_level: alertLevel,
    alert_reasons: reasons,
    dominant_dimension: dominant.dim,
    dominant_ratio: dominant.ratio,
    last_upkeep_at: lastUpkeep,
    days_since_upkeep: daysCand?.daysSince ?? days,
    yield_usage_pct: yieldCand?.yieldPct,
    days_usage_pct: daysCand?.daysPct,
    remaining_days: dominant.dim === 'days' ? remainingDays : remainingDays,
  };
}

export function buildEquipmentWorkbenchMaintenanceRows(
  equipments: EquipmentRow[],
  lastUpkeepByEquipment: Map<string, string>,
  labelByValue?: Record<string, string>,
): EquipmentMaintenanceAlertRow[] {
  const rows: EquipmentMaintenanceAlertRow[] = [];
  for (const e of equipments) {
    const evaluated = evaluateEquipmentMaintenanceAlert(e, lastUpkeepByEquipment, labelByValue);
    if (evaluated) rows.push(evaluated);
  }
  return rows;
}

export function buildEquipmentMaintenanceAlertRows(
  equipments: EquipmentRow[],
  lastUpkeepByEquipment: Map<string, string>,
  labelByValue?: Record<string, string>,
): EquipmentMaintenanceAlertRow[] {
  return buildEquipmentWorkbenchMaintenanceRows(equipments, lastUpkeepByEquipment, labelByValue);
}

export function isActionableEquipmentMaintenanceRow(row: EquipmentMaintenanceAlertRow): boolean {
  if (
    row.reminder_kind === 'manual_maintenance' ||
    row.reminder_kind === 'setup_no_cycle' ||
    row.reminder_kind === 'setup_no_baseline'
  ) {
    return true;
  }
  return row.alert_level === 'warning' || row.alert_level === 'critical';
}

/** @deprecated 使用 isActionableEquipmentMaintenanceRow */
export function isWorkbenchVisibleEquipmentMaintenanceRow(row: EquipmentMaintenanceAlertRow): boolean {
  return isActionableEquipmentMaintenanceRow(row);
}

export function passesSeverityFilter(row: EquipmentMaintenanceAlertRow, min: string | undefined): boolean {
  if (
    row.reminder_kind === 'manual_maintenance' ||
    row.reminder_kind === 'setup_no_cycle' ||
    row.reminder_kind === 'setup_no_baseline'
  ) {
    if (!min || min === 'all') return true;
    if (min === 'critical') return false;
    return true;
  }
  if (!min || min === 'all') return true;
  const r = severityRank[row.alert_level];
  if (min === 'critical') return row.alert_level === 'critical';
  if (min === 'warning') return r <= severityRank.warning;
  return true;
}

export function sortMaintenanceAlertRows(a: EquipmentMaintenanceAlertRow, b: EquipmentMaintenanceAlertRow): number {
  const aKind = KIND_RANK[a.reminder_kind] ?? 9;
  const bKind = KIND_RANK[b.reminder_kind] ?? 9;
  if (aKind !== bKind) return aKind - bKind;
  const d = severityRank[a.alert_level] - severityRank[b.alert_level];
  if (d !== 0) return d;
  const ratioD = b.dominant_ratio - a.dominant_ratio;
  if (ratioD !== 0) return ratioD;
  return String(a.asset_code).localeCompare(String(b.asset_code));
}

export function sortEquipmentWorkbenchMaintenanceRows(
  a: EquipmentMaintenanceAlertRow,
  b: EquipmentMaintenanceAlertRow,
): number {
  return sortMaintenanceAlertRows(a, b);
}

export function maintenanceProgressPercent(row: EquipmentMaintenanceAlertRow): number {
  return Math.min(100, Math.round(row.dominant_ratio * 1000) / 10);
}

export function maintenanceProgressColor(
  percent: number,
  token: { colorError: string; colorWarning: string; colorSuccess: string },
): string {
  if (percent >= 100) return token.colorError;
  if (percent >= 90) return token.colorWarning;
  return token.colorSuccess;
}

export function dominantDimensionLabel(dim: MaintenanceAlertDimension | null): string {
  if (dim === 'yield') return '依产量';
  if (dim === 'days') return '依天数';
  return '—';
}

export function reminderKindLabel(kind: EquipmentMaintenanceReminderKind): string {
  if (kind === 'manual_maintenance') return '待保养';
  if (kind === 'setup_no_cycle') return '待配置';
  if (kind === 'setup_no_baseline') return '待配置';
  return '周期计划';
}

export function formatMaintenanceEmptySummary(summary: MaintenanceReminderSummary | null): string {
  if (!summary) return '暂无设备保养计划数据';
  const { total_ledger, actionable, by_kind } = summary;
  const noCycle = by_kind?.setup_no_cycle ?? 0;
  const noBaseline = by_kind?.setup_no_baseline ?? 0;
  if (actionable > 0) return `台账 ${total_ledger} 台，当前筛选下无可展示行（可执行 ${actionable} 项）`;
  return `台账 ${total_ledger} 台，暂无可执行保养项（未配置周期 ${noCycle}，无保养基准 ${noBaseline}）`;
}

export const WORKSPACE_EQUIPMENT_MAINTENANCE_TOP_N = 5;

export async function loadEquipmentMaintenanceAlertDataset(): Promise<{
  equipments: EquipmentRow[];
  lastUpkeepByEquipment: Map<string, string>;
}> {
  const [equipments, lastUpkeepByEquipment] = await Promise.all([
    fetchAllPaged((skip, limit) => listEquipments({ skip, limit })),
    buildLastUpkeepByEquipment(),
  ]);
  return { equipments, lastUpkeepByEquipment };
}

export async function loadEquipmentMaintenanceAlertRows(
  labelByValue?: Record<string, string>,
): Promise<EquipmentMaintenanceAlertRow[]> {
  const { equipments, lastUpkeepByEquipment } = await loadEquipmentMaintenanceAlertDataset();
  return buildEquipmentMaintenanceAlertRows(equipments, lastUpkeepByEquipment, labelByValue);
}

export function countMaintenanceAlertWarnCritical(rows: EquipmentMaintenanceAlertRow[]): number {
  return rows.filter((r) => r.alert_level === 'warning' || r.alert_level === 'critical').length;
}

export function countEquipmentWorkbenchMaintenanceReminders(rows: EquipmentMaintenanceAlertRow[]): number {
  return rows.filter(isActionableEquipmentMaintenanceRow).length;
}

export function topMaintenanceAlertRows(
  rows: EquipmentMaintenanceAlertRow[],
  limit = WORKSPACE_EQUIPMENT_MAINTENANCE_TOP_N,
): EquipmentMaintenanceAlertRow[] {
  return [...rows]
    .filter(isActionableEquipmentMaintenanceRow)
    .sort(sortEquipmentWorkbenchMaintenanceRows)
    .slice(0, limit);
}

export async function fetchEquipmentMaintenanceRemindersPage(params?: {
  keyword?: string;
  severity_min?: string;
  actionable_only?: boolean;
  reminder_kinds?: string;
  limit?: number;
  offset?: number;
  preview?: boolean;
}): Promise<{ items: EquipmentMaintenanceAlertRow[]; summary: MaintenanceReminderSummary }> {
  const res = await fetchEquipmentMaintenanceReminders(params);
  return {
    items: res.items as EquipmentMaintenanceAlertRow[],
    summary: res.summary,
  };
}
