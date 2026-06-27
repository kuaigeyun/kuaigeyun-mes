import type { QualityIssueKind } from './qualityMeta';

export const QUALITY_ISSUE_OVERDUE_NOTIFY_BY_KIND_KEY = 'quality_issue_overdue_notify_by_kind';

export type QualityIssueOverdueNotifyByKindConfig = {
  equipment?: number[];
  product?: number[];
};

/** 处理措施预填：优先 issue_kind，否则有设备则视为设备品质问题 */
export function resolveQualityIssueKindForOverdueNotify(input: {
  issue_kind?: string | null;
  equipment_id?: number | null;
}): QualityIssueKind | null {
  const explicit = (input.issue_kind || '').trim() as QualityIssueKind;
  if (explicit === 'equipment' || explicit === 'product') return explicit;
  const equipmentId = Number(input.equipment_id);
  if (Number.isFinite(equipmentId) && equipmentId > 0) return 'equipment';
  return null;
}

function normalizeUserIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => Number(v)).filter((id) => Number.isFinite(id) && id > 0);
}

export function parseQualityIssueOverdueNotifyByKind(
  haoligoParameters: Record<string, unknown> | null | undefined,
): QualityIssueOverdueNotifyByKindConfig {
  const raw = haoligoParameters?.[QUALITY_ISSUE_OVERDUE_NOTIFY_BY_KIND_KEY];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const obj = raw as Record<string, unknown>;
  return {
    equipment: normalizeUserIds(obj.equipment),
    product: normalizeUserIds(obj.product),
  };
}

export function getQualityIssueOverdueNotifyIdsForKind(
  haoligoParameters: Record<string, unknown> | null | undefined,
  issueKind: string | null | undefined,
): number[] {
  const key = (issueKind || '').trim() as QualityIssueKind;
  if (key !== 'equipment' && key !== 'product') return [];
  const config = parseQualityIssueOverdueNotifyByKind(haoligoParameters);
  return normalizeUserIds(config[key]);
}
