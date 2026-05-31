/**
 * 模具保养预警：保养完修记录 + 依产量维保周期。
 */
import { fetchMaintenanceUpkeepLastByMold, listMolds, type MoldRow } from '../services/haoligo';

export type AlertLevel = 'critical' | 'warning' | 'ok';
export type MaintenanceAlertDimension = 'yield';

export interface MoldMaintenanceAlertRow extends MoldRow {
  alert_level: AlertLevel;
  alert_reasons: string[];
  dominant_dimension: MaintenanceAlertDimension | null;
  dominant_ratio: number;
  last_upkeep_at: string;
  yield_usage_pct?: number;
}

export const severityRank: Record<AlertLevel, number> = {
  critical: 0,
  warning: 1,
  ok: 2,
};

const WARN_RATIO = 0.9;

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

/** 厂内保养完修 + 外协已通过保养完修 → 各模具最近一次保养时间 */
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

function reasonForYield(level: AlertLevel): string {
  if (level === 'critical') return '累计产量已达或超过「依产量」维保周期';
  return '累计产量已接近「依产量」维保周期（≥90%）';
}

/**
 * 评估单模具保养预警；无保养记录或未配置依产量周期时返回 null。
 */
function hasPositiveUsedYield(usedYield: string | number | null | undefined): boolean {
  const n = parseDec(usedYield);
  return n != null && n > 0;
}

export function evaluateMoldMaintenanceAlert(
  row: MoldRow,
  lastUpkeepByMold: Map<string, string>,
): MoldMaintenanceAlertRow | null {
  const mcode = normalizeMoldCode(String(row.mold_code || ''));
  if (!mcode) return null;

  if (!hasPositiveUsedYield(row.used_yield)) return null;

  const lastUpkeep = lookupLastUpkeep(lastUpkeepByMold, mcode);
  if (!lastUpkeep) return null;

  const cycleY = parseDec(row.maintenance_cycle_by_yield);
  const usedY = parseDec(row.used_yield ?? '') ?? 0;
  if (cycleY == null || cycleY <= 0) return null;

  const ratio = usedY / cycleY;
  const alertLevel = levelFromRatio(ratio);
  const reasons: string[] = [];
  if (alertLevel === 'critical' || alertLevel === 'warning') {
    reasons.push(reasonForYield(alertLevel));
  }

  return {
    ...row,
    alert_level: alertLevel,
    alert_reasons: reasons,
    dominant_dimension: 'yield',
    dominant_ratio: ratio,
    last_upkeep_at: lastUpkeep,
    yield_usage_pct: Math.round(ratio * 1000) / 10,
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

export function passesSeverityFilter(row: MoldMaintenanceAlertRow, min: string | undefined): boolean {
  if (!min || min === 'all') return true;
  const r = severityRank[row.alert_level];
  if (min === 'critical') return row.alert_level === 'critical';
  if (min === 'warning') return r <= severityRank.warning;
  return true;
}

export function sortMaintenanceAlertRows(a: MoldMaintenanceAlertRow, b: MoldMaintenanceAlertRow): number {
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
  if (dim === 'yield') return '依产量';
  return '—';
}

export const WORKSPACE_MAINTENANCE_ALERT_TOP_N = 5;

export async function loadMoldMaintenanceAlertRows(): Promise<MoldMaintenanceAlertRow[]> {
  const { molds, lastUpkeepByMold } = await loadMoldMaintenanceAlertDataset();
  return buildMoldMaintenanceAlertRows(molds, lastUpkeepByMold);
}

export function countMaintenanceAlertWarnCritical(rows: MoldMaintenanceAlertRow[]): number {
  return rows.filter((r) => r.alert_level === 'warning' || r.alert_level === 'critical').length;
}

/** 工作台：仅展示有累计产量且达预警的模具（无产量或保养清零后不展示） */
export function isWorkbenchVisibleMoldMaintenanceRow(row: MoldMaintenanceAlertRow): boolean {
  return row.alert_level === 'warning' || row.alert_level === 'critical';
}

export function topMaintenanceAlertRows(
  rows: MoldMaintenanceAlertRow[],
  limit = WORKSPACE_MAINTENANCE_ALERT_TOP_N,
): MoldMaintenanceAlertRow[] {
  return [...rows].filter(isWorkbenchVisibleMoldMaintenanceRow).sort(sortMaintenanceAlertRows).slice(0, limit);
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
