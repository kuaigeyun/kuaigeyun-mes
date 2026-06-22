export const MOLD_REPAIR_URGENCY_LEVELS = ['一般', '紧急'] as const;
export type MoldRepairUrgencyLevel = (typeof MOLD_REPAIR_URGENCY_LEVELS)[number];
export const MOLD_REPAIR_URGENCY_DEFAULT: MoldRepairUrgencyLevel = '一般';

export function moldRepairUrgencyOptions() {
  return MOLD_REPAIR_URGENCY_LEVELS.map((v) => ({ label: v, value: v }));
}
