import type { QualityLineStopKind } from './qualityMeta';

export const QUALITY_LINE_STOP_OVERDUE_NOTIFY_BY_KIND_KEY = 'quality_line_stop_overdue_notify_by_kind';

export type QualityLineStopOverdueNotifyByKindConfig = {
  equipment?: number[];
  quality?: number[];
};

function normalizeUserIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => Number(v)).filter((id) => Number.isFinite(id) && id > 0);
}

export function parseQualityLineStopOverdueNotifyByKind(
  haoligoParameters: Record<string, unknown> | null | undefined,
): QualityLineStopOverdueNotifyByKindConfig {
  const raw = haoligoParameters?.[QUALITY_LINE_STOP_OVERDUE_NOTIFY_BY_KIND_KEY];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const obj = raw as Record<string, unknown>;
  return {
    equipment: normalizeUserIds(obj.equipment),
    quality: normalizeUserIds(obj.quality),
  };
}

export function getQualityLineStopOverdueNotifyIdsForKind(
  haoligoParameters: Record<string, unknown> | null | undefined,
  stopKind: string | null | undefined,
): number[] {
  const key = (stopKind === 'quality' ? 'quality' : 'equipment') as QualityLineStopKind;
  const config = parseQualityLineStopOverdueNotifyByKind(haoligoParameters);
  return normalizeUserIds(config[key]);
}
