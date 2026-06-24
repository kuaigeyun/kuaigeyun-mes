import type {
  EquipmentAcceptanceRoundRow,
  EquipmentAcceptanceSheetRow,
  EquipmentAcceptanceWorkflowStatus,
} from '../services/haoligo';

/** Ant Design Tag color，与列表/详情流程状态徽章一致 */
const ACCEPTANCE_WORKFLOW_STATUS_TAG_COLOR: Record<EquipmentAcceptanceWorkflowStatus, string> = {
  draft: 'default',
  commissioning: 'blue',
  pending_trial: 'gold',
  trial_recording: 'processing',
  accepted: 'success',
  closed: 'default',
};

export function acceptanceWorkflowStatusTagColor(status: string | null | undefined): string {
  const key = (status || '').trim() as EquipmentAcceptanceWorkflowStatus;
  return ACCEPTANCE_WORKFLOW_STATUS_TAG_COLOR[key] ?? 'default';
}

export function calcAcceptancePassRate(
  quantity: string | number | null | undefined,
  defectQty: string | number | null | undefined,
): number | null {
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) return null;
  const defects = Number(defectQty);
  const safeDefects = Number.isFinite(defects) ? defects : 0;
  const rate = ((qty - safeDefects) / qty) * 100;
  return Math.round(rate * 100) / 100;
}

export function formatAcceptancePassRate(rate: number | null | undefined): string {
  if (rate == null || !Number.isFinite(rate)) return '—';
  return `${rate.toFixed(2)}%`;
}

export function currentAcceptanceRound(
  sheet: EquipmentAcceptanceSheetRow,
): EquipmentAcceptanceRoundRow | null {
  const rounds = sheet.rounds ?? [];
  const current = sheet.current_round ?? 1;
  return rounds.find((r) => r.round_no === current) ?? rounds[rounds.length - 1] ?? null;
}

export function commissioningContentRequired(roundNo: number): boolean {
  return roundNo >= 2;
}

export const ACCEPTANCE_RESULT_OPTIONS = [
  { label: '合格', value: '合格' },
  { label: '不合格', value: '不合格' },
];
