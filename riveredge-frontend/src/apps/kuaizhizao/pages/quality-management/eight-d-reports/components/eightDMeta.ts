import type { SubStage } from '../../../../../../components/uni-lifecycle/types';
import type { TFunction } from 'i18next';

export const EIGHT_D_STATUS_ORDER = [
  'd1_team',
  'd2_problem',
  'd3_containment',
  'd4_root_cause',
  'd5_corrective_action',
  'd6_implement_result',
  'd7_prevent_recurrence',
  'd8_team_congratulation',
  'closed',
] as const;

export type EightDStatus = (typeof EIGHT_D_STATUS_ORDER)[number];

export const EIGHT_D_STATUS_I18N_KEY: Record<EightDStatus, string> = {
  d1_team: 'app.kuaizhizao.eightD.status.d1_team',
  d2_problem: 'app.kuaizhizao.eightD.status.d2_problem',
  d3_containment: 'app.kuaizhizao.eightD.status.d3_containment',
  d4_root_cause: 'app.kuaizhizao.eightD.status.d4_root_cause',
  d5_corrective_action: 'app.kuaizhizao.eightD.status.d5_corrective_action',
  d6_implement_result: 'app.kuaizhizao.eightD.status.d6_implement_result',
  d7_prevent_recurrence: 'app.kuaizhizao.eightD.status.d7_prevent_recurrence',
  d8_team_congratulation: 'app.kuaizhizao.eightD.status.d8_team_congratulation',
  closed: 'app.kuaizhizao.eightD.status.closed',
};

export const EIGHT_D_STAGE_FIELDS: Record<string, string> = {
  d1_team: 'd1_team',
  d2_problem: 'd2_problem',
  d3_containment: 'd3_containment',
  d4_root_cause: 'd4_root_cause',
  d5_corrective_action: 'd5_corrective_action',
  d6_implement_result: 'd6_implement_result',
  d7_prevent_recurrence: 'd7_prevent_recurrence',
  d8_team_congratulation: 'd8_team_congratulation',
};

export function getEightDNextStatus(status?: string | null): EightDStatus | undefined {
  if (!status) return undefined;
  const idx = EIGHT_D_STATUS_ORDER.findIndex((item) => item === status);
  if (idx < 0 || idx >= EIGHT_D_STATUS_ORDER.length - 1) return undefined;
  return EIGHT_D_STATUS_ORDER[idx + 1];
}

export function getEightDStatusText(t: TFunction, status?: string | null): string {
  if (!status) return '-';
  const key = EIGHT_D_STATUS_I18N_KEY[status as EightDStatus];
  if (!key) return status;
  return t(key);
}

export function buildEightDStepperSteps(t: TFunction, status?: string | null): SubStage[] {
  const idx = EIGHT_D_STATUS_ORDER.findIndex((item) => item === status);
  const activeIndex = idx >= 0 ? idx : 0;
  return EIGHT_D_STATUS_ORDER.map((key, index) => ({
    key,
    label: t(EIGHT_D_STATUS_I18N_KEY[key]),
    status: index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'pending',
  }));
}

export const EIGHT_D_SEVERITY_I18N_KEY: Record<string, string> = {
  minor: 'app.kuaizhizao.eightD.severity.minor',
  major: 'app.kuaizhizao.eightD.severity.major',
  critical: 'app.kuaizhizao.eightD.severity.critical',
};

export function getEightDSeverityText(t: TFunction, severity?: string | null): string {
  if (!severity) return '-';
  const key = EIGHT_D_SEVERITY_I18N_KEY[severity];
  if (!key) return severity;
  return t(key);
}
