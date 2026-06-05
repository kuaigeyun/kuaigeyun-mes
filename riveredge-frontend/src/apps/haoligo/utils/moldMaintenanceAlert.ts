/**
 * 模具保养预警：保养完修记录 + 依产量双轨（已用产量 / 总制造数量取最紧）。
 */
import {
  fetchMaintenanceUpkeepLastByMold,
  fetchMoldMaintenanceReminders,
  listMolds,
  type MaintenanceReminderSummary,
  type MoldMaintenanceReminderItem,
  type MoldRow,
} from '../services/haoligo';

export type AlertLevel = 'critical' | 'warning' | 'ok';
export type MaintenanceAlertDimension = 'yield' | 'yield_total';
export type MoldMaintenanceReminderKind =
  | 'manual_maintenance'
  | 'cycle_plan'
  | 'setup_no_cycle'
  | 'setup_no_baseline';

export type MoldMaintenanceAlertRow = MoldRow & MoldMaintenanceReminderItem;

export const severityRank: Record<AlertLevel, number> = {
  critical: 0,
  warning: 1,
  ok: 2,
};

const KIND_RANK: Record<MoldMaintenanceReminderKind, number> = {
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

function normalizeMoldCode(code: string): string {
  return code.trim();
}

function lookupLastUpkeep(map: Map<string, string>, moldCode: string): string | undefined {
  const key = normalizeMoldCode(moldCode);
  if (!key) return undefined;
  const direct = map.get(key);
  if (direct) return direct;
  const lower = key.toLowerCase();
  for (const [k, v] of map) {
    if (k.toLowerCase() === lower) return v;
  }
  return undefined;
}

export async function buildLastUpkeepByMold(): Promise<Map<string, string>> {
  const res = await fetchMaintenanceUpkeepLastByMold();
  const map = new Map<string, string>();
  for (const [code, at] of Object.entries(res.items ?? {})) {
    const key = normalizeMoldCode(code);
    if (key && at) map.set(key, at);
  }
  return map;
}

function levelFromRatio(ratio: number): AlertLevel {
  if (ratio >= 1) return 'critical';
  if (ratio >= WARN_RATIO) return 'warning';
  return 'ok';
}

export function moldHasCycle(row: Pick<MoldRow, 'maintenance_cycle_by_yield'>): boolean {
  const cy = parseDec(row.maintenance_cycle_by_yield);
  return cy != null && cy > 0;
}

export function moldNeedsTracking(
  row: Pick<MoldRow, 'used_yield' | 'total_manufacture_qty' | 'status'>,
): boolean {
  const uy = parseDec(row.used_yield);
  if (uy != null && uy > 0) return true;
  const tq = parseDec(row.total_manufacture_qty);
  if (tq != null && tq > 0) return true;
  return String(row.status ?? '').trim() === '在用';
}

export function buildManualMoldMaintenanceReminderRow(row: MoldRow): MoldMaintenanceAlertRow | null {
  if (String(row.status ?? '').trim() !== '保养') return null;
  return {
    ...row,
    reminder_kind: 'manual_maintenance',
    alert_level: 'warning',
    alert_reasons: ['模具台账状态为保养，请安排保养作业'],
    dominant_dimension: null,
    dominant_ratio: 0,
    last_upkeep_at: null,
  };
}

export function evaluateMoldMaintenanceAlert(
  row: MoldRow,
  lastUpkeepByMold: Map<string, string>,
): MoldMaintenanceAlertRow | null {
  const mcode = normalizeMoldCode(String(row.mold_code || ''));
  if (!mcode) return null;

  const manual = buildManualMoldMaintenanceReminderRow(row);
  if (manual) return manual;

  const hasCycle = moldHasCycle(row);
  const lastUpkeep = lookupLastUpkeep(lastUpkeepByMold, mcode);

  if (!hasCycle) {
    if (!moldNeedsTracking(row)) return null;
    return {
      ...row,
      reminder_kind: 'setup_no_cycle',
      alert_level: 'warning',
      alert_reasons: ['未配置保养周期（依产量），请维护模具台账'],
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

  const cycleY = parseDec(row.maintenance_cycle_by_yield)!;
  const usedY = parseDec(row.used_yield ?? '') ?? 0;
  const totalQ = parseDec(row.total_manufacture_qty ?? '') ?? 0;
  const rated = parseDec(row.usable_yield);

  const candidates: { dim: MaintenanceAlertDimension; ratio: number; pct: number }[] = [];
  if (usedY > 0) {
    const ratio = usedY / cycleY;
    candidates.push({ dim: 'yield', ratio, pct: Math.round((ratio) * 1000) / 10 });
  }
  if (totalQ > 0) {
    const ratio = totalQ / cycleY;
    candidates.push({ dim: 'yield_total', ratio, pct: Math.round((ratio) * 1000) / 10 });
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
    };
  }

  const dominant = candidates.reduce((best, cur) => (cur.ratio > best.ratio ? cur : best));
  const alertLevel = levelFromRatio(dominant.ratio);

  const reasons: string[] = [];
  for (const c of candidates) {
    const lv = levelFromRatio(c.ratio);
    if (lv !== 'critical' && lv !== 'warning') continue;
    if (c.dim === 'yield') {
      reasons.push(lv === 'critical' ? '已用产量已达或超过保养周期' : '已用产量已接近保养周期（≥90%）');
    } else {
      reasons.push(
        lv === 'critical' ? '总制造数量已达或超过保养周期' : '总制造数量已接近保养周期（≥90%）',
      );
    }
  }

  let remainingYieldPct: number | undefined;
  if (rated != null && rated > 0) {
    const remaining = Math.max(0, rated - usedY);
    remainingYieldPct = Math.round((remaining / rated) * 1000) / 10;
    if (remainingYieldPct <= 10) {
      reasons.push(`额定可用产量余量仅约 ${remainingYieldPct}%（已用 ${usedY} / 额定 ${rated}）`);
    }
  }

  const yieldCand = candidates.find((c) => c.dim === 'yield');
  const totalCand = candidates.find((c) => c.dim === 'yield_total');

  return {
    ...row,
    reminder_kind: 'cycle_plan',
    alert_level: alertLevel,
    alert_reasons: reasons,
    dominant_dimension: dominant.dim,
    dominant_ratio: dominant.ratio,
    last_upkeep_at: lastUpkeep,
    yield_usage_pct: yieldCand?.pct,
    total_yield_usage_pct: totalCand?.pct,
    remaining_yield_pct: remainingYieldPct,
  };
}

export function buildMoldMaintenanceAlertRows(
  molds: MoldRow[],
  lastUpkeepByMold: Map<string, string>,
): MoldMaintenanceAlertRow[] {
  const rows: MoldMaintenanceAlertRow[] = [];
  for (const m of molds) {
    const evaluated = evaluateMoldMaintenanceAlert(m, lastUpkeepByMold);
    if (evaluated) rows.push(evaluated);
  }
  return rows;
}

export function isActionableMoldMaintenanceRow(row: MoldMaintenanceAlertRow): boolean {
  if (
    row.reminder_kind === 'manual_maintenance' ||
    row.reminder_kind === 'setup_no_cycle' ||
    row.reminder_kind === 'setup_no_baseline'
  ) {
    return true;
  }
  return row.alert_level === 'warning' || row.alert_level === 'critical';
}

/** @deprecated 使用 isActionableMoldMaintenanceRow */
export function isWorkbenchVisibleMoldMaintenanceRow(row: MoldMaintenanceAlertRow): boolean {
  return isActionableMoldMaintenanceRow(row);
}

export function passesSeverityFilter(row: MoldMaintenanceAlertRow, min: string | undefined): boolean {
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

export function sortMaintenanceAlertRows(a: MoldMaintenanceAlertRow, b: MoldMaintenanceAlertRow): number {
  const aKind = KIND_RANK[a.reminder_kind] ?? 9;
  const bKind = KIND_RANK[b.reminder_kind] ?? 9;
  if (aKind !== bKind) return aKind - bKind;
  const d = severityRank[a.alert_level] - severityRank[b.alert_level];
  if (d !== 0) return d;
  const ratioD = b.dominant_ratio - a.dominant_ratio;
  if (ratioD !== 0) return ratioD;
  return String(a.mold_code).localeCompare(String(b.mold_code));
}

export function maintenanceProgressPercent(row: MoldMaintenanceAlertRow): number {
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
  if (dim === 'yield') return '已用产量';
  if (dim === 'yield_total') return '总制造数量';
  return '—';
}

export function reminderKindLabel(kind: MoldMaintenanceReminderKind): string {
  if (kind === 'manual_maintenance') return '待保养';
  if (kind === 'setup_no_cycle') return '待配置';
  if (kind === 'setup_no_baseline') return '待配置';
  return '周期计划';
}

export function formatMoldMaintenanceEmptySummary(summary: MaintenanceReminderSummary | null): string {
  if (!summary) return '暂无保养预警数据';
  const { total_ledger, actionable, by_kind } = summary;
  const noCycle = by_kind?.setup_no_cycle ?? 0;
  const noBaseline = by_kind?.setup_no_baseline ?? 0;
  if (actionable > 0) return `台账 ${total_ledger} 套，当前筛选下无可展示行（可执行 ${actionable} 项）`;
  return `台账 ${total_ledger} 套，暂无可执行保养项（未配置周期 ${noCycle}，无保养基准 ${noBaseline}）`;
}

export const WORKSPACE_MAINTENANCE_ALERT_TOP_N = 5;

export async function loadMoldMaintenanceAlertRows(): Promise<MoldMaintenanceAlertRow[]> {
  const { molds, lastUpkeepByMold } = await loadMoldMaintenanceAlertDataset();
  return buildMoldMaintenanceAlertRows(molds, lastUpkeepByMold);
}

export function countMaintenanceAlertWarnCritical(rows: MoldMaintenanceAlertRow[]): number {
  return rows.filter((r) => r.alert_level === 'warning' || r.alert_level === 'critical').length;
}

export function topMaintenanceAlertRows(
  rows: MoldMaintenanceAlertRow[],
  limit = WORKSPACE_MAINTENANCE_ALERT_TOP_N,
): MoldMaintenanceAlertRow[] {
  return [...rows]
    .filter(isActionableMoldMaintenanceRow)
    .sort(sortMaintenanceAlertRows)
    .slice(0, limit);
}

export async function loadMoldMaintenanceAlertDataset(): Promise<{
  molds: MoldRow[];
  lastUpkeepByMold: Map<string, string>;
}> {
  const [molds, lastUpkeepByMold] = await Promise.all([
    fetchAllPaged((skip, limit) => listMolds({ skip, limit })),
    buildLastUpkeepByMold(),
  ]);
  return { molds, lastUpkeepByMold };
}

export async function fetchMoldMaintenanceRemindersPage(params?: {
  keyword?: string;
  severity_min?: string;
  actionable_only?: boolean;
  reminder_kinds?: string;
  status?: string;
  limit?: number;
  offset?: number;
  preview?: boolean;
}): Promise<{ items: MoldMaintenanceAlertRow[]; summary: MaintenanceReminderSummary }> {
  const res = await fetchMoldMaintenanceReminders(params);
  return {
    items: res.items as MoldMaintenanceAlertRow[],
    summary: res.summary,
  };
}
