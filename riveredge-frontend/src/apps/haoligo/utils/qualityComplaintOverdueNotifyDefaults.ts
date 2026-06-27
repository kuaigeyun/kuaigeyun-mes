export const QUALITY_COMPLAINT_OVERDUE_NOTIFY_USER_IDS_KEY = 'quality_complaint_overdue_notify_user_ids';

function normalizeUserIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => Number(v)).filter((id) => Number.isFinite(id) && id > 0);
}

export function getQualityComplaintOverdueNotifyIds(
  haoligoParameters: Record<string, unknown> | null | undefined,
): number[] {
  return normalizeUserIds(haoligoParameters?.[QUALITY_COMPLAINT_OVERDUE_NOTIFY_USER_IDS_KEY]);
}
