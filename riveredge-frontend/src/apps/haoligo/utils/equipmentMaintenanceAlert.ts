/**
 * 设备保养计划：保养完修记录 + 依产量/依天数周期（先达到者预警）。
 */
import dayjs from 'dayjs';
import { fetchMaintenanceUpkeepLastByEquipment, listEquipments, type EquipmentRow } from '../services/haoligo';

export type AlertLevel = 'critical' | 'warning' | 'ok';
export type MaintenanceAlertDimension = 'yield' | 'days';

export interface EquipmentMaintenanceAlertRow extends EquipmentRow {
  alert_level: AlertLevel;
  alert_reasons: string[];
  dominant_dimension: MaintenanceAlertDimension | null;
  dominant_ratio: number;
  last_upkeep_at: string;
  days_since_upkeep?: number;
  yield_usage_pct?: number;
  days_usage_pct?: number;
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

function parsePositiveInt(v: number | string | null | undefined): number | undefined {
  const n = parseDec(v);
  if (n == null || n <= 0) return undefined;
  return Math.trunc(n);
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

function reasonForDimension(dim: MaintenanceAlertDimension, _ratio: number, level: AlertLevel): string {
  if (dim === 'yield') {
    if (level === 'critical') return '累计产量已达或超过「依产量」维保周期';
    return '累计产量已接近「依产量」维保周期（≥90%）';
  }
  if (level === 'critical') return '距上次保养已超过「依天数」维保周期';
  return '距上次保养已接近「依天数」维保周期（≥90%）';
}

export function evaluateEquipmentMaintenanceAlert(
  row: EquipmentRow,
  lastUpkeepByEquipment: Map<string, string>,
): EquipmentMaintenanceAlertRow | null {
  const acode = normalizeAssetCode(String(row.asset_code || ''));
  if (!acode) return null;

  const lastUpkeep = lookupLastUpkeep(lastUpkeepByEquipment, acode);
  if (!lastUpkeep) return null;

  const cycleY = parseDec(row.maintenance_cycle_by_yield);
  const usedY = parseDec(row.used_yield ?? '') ?? 0;
  const cycleD = parsePositiveInt(row.maintenance_cycle_by_days);

  const candidates: {
    dim: MaintenanceAlertDimension;
    ratio: number;
    yieldPct?: number;
    daysSince?: number;
    daysPct?: number;
  }[] = [];

  if (cycleY != null && cycleY > 0) {
    candidates.push({
      dim: 'yield',
      ratio: usedY / cycleY,
      yieldPct: Math.round((usedY / cycleY) * 1000) / 10,
    });
  }

  if (cycleD != null) {
    const days = dayjs().startOf('day').diff(dayjs(lastUpkeep).startOf('day'), 'day');
    candidates.push({
      dim: 'days',
      ratio: days / cycleD,
      daysSince: days,
      daysPct: Math.round((days / cycleD) * 1000) / 10,
    });
  }

  if (candidates.length === 0) return null;

  const dominant = candidates.reduce((best, cur) => (cur.ratio > best.ratio ? cur : best));
  const alertLevel = levelFromRatio(dominant.ratio);

  const reasons: string[] = [];
  for (const c of candidates) {
    const lv = levelFromRatio(c.ratio);
    if (lv === 'critical' || lv === 'warning') {
      reasons.push(reasonForDimension(c.dim, c.ratio, lv));
    }
  }

  const yieldCand = candidates.find((c) => c.dim === 'yield');
  const daysCand = candidates.find((c) => c.dim === 'days');

  return {
    ...row,
    alert_level: alertLevel,
    alert_reasons: reasons,
    dominant_dimension: dominant.dim,
    dominant_ratio: dominant.ratio,
    last_upkeep_at: lastUpkeep,
    days_since_upkeep: daysCand?.daysSince,
    yield_usage_pct: yieldCand?.yieldPct,
    days_usage_pct: daysCand?.daysPct,
  };
}

export function buildEquipmentMaintenanceAlertRows(
  equipments: EquipmentRow[],
  lastUpkeepByEquipment: Map<string, string>,
): EquipmentMaintenanceAlertRow[] {
  const rows: EquipmentMaintenanceAlertRow[] = [];
  for (const e of equipments) {
    const evaluated = evaluateEquipmentMaintenanceAlert(e, lastUpkeepByEquipment);
    if (evaluated) rows.push(evaluated);
  }
  return rows;
}

export function passesSeverityFilter(row: EquipmentMaintenanceAlertRow, min: string | undefined): boolean {
  if (!min || min === 'all') return true;
  const r = severityRank[row.alert_level];
  if (min === 'critical') return row.alert_level === 'critical';
  if (min === 'warning') return r <= severityRank.warning;
  return true;
}

export function sortMaintenanceAlertRows(a: EquipmentMaintenanceAlertRow, b: EquipmentMaintenanceAlertRow): number {
  const d = severityRank[a.alert_level] - severityRank[b.alert_level];
  if (d !== 0) return d;
  const ratioD = b.dominant_ratio - a.dominant_ratio;
  if (ratioD !== 0) return ratioD;
  return String(a.asset_code).localeCompare(String(b.asset_code));
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

export async function loadEquipmentMaintenanceAlertRows(): Promise<EquipmentMaintenanceAlertRow[]> {
  const { equipments, lastUpkeepByEquipment } = await loadEquipmentMaintenanceAlertDataset();
  return buildEquipmentMaintenanceAlertRows(equipments, lastUpkeepByEquipment);
}

export function countMaintenanceAlertWarnCritical(rows: EquipmentMaintenanceAlertRow[]): number {
  return rows.filter((r) => r.alert_level === 'warning' || r.alert_level === 'critical').length;
}

export function topMaintenanceAlertRows(
  rows: EquipmentMaintenanceAlertRow[],
  limit = WORKSPACE_EQUIPMENT_MAINTENANCE_TOP_N,
): EquipmentMaintenanceAlertRow[] {
  return [...rows].sort(sortMaintenanceAlertRows).slice(0, limit);
}
