import type { SubStage } from '../../../../../../components/uni-lifecycle/types';
import type { TFunction } from 'i18next';
import type { WorkOrderOperationStep } from '../../../production-execution/work-orders/workOrderOperationSteps';

export const EIGHT_D_STATUS_ORDER = [
  'd0_prepare',
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
  d0_prepare: 'app.kuaizhizao.eightD.status.d0_prepare',
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
  d0_prepare: 'd0_prepare',
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

/**
 * 列表阶段节点轴：始终展开完整 D1–D8 + 已关闭（禁止用残缺 lifecycle_stages 导致列内大块留白）。
 * 后端 lifecycle 仅用于覆盖各节点 done/active/pending。
 */
export function buildEightDListStepNodes(
  t: TFunction,
  status?: string | null,
  lifecycleStages?: Array<{ key: string; label: string; status: 'done' | 'active' | 'pending' }>,
): WorkOrderOperationStep[] {
  const statusByKey = new Map(
    (lifecycleStages ?? []).map((stage) => [String(stage.key), stage.status] as const),
  );
  const stages = buildEightDStepperSteps(t, status).map((stage) => ({
    ...stage,
    status: statusByKey.get(String(stage.key)) ?? stage.status,
  }));
  return stages.map((stage, index) => {
    const fullLabel = stage.label || getEightDStatusText(t, stage.key);
    const parsed = parseEightDStageLabel(fullLabel);
    const keyMatch = String(stage.key).match(/^d(\d)_/i);
    const name =
      parsed?.code ??
      (keyMatch ? `D${keyMatch[1]}` : null) ??
      (stage.key === 'closed' ? getEightDStatusText(t, 'closed') : fullLabel);
    return {
      name,
      sequence: index + 1,
      status: stage.status,
    };
  });
}

/** 列表阶段节点轴单槽宽（D1–D8 / 已关闭 标签较短，略窄于工单工序列） */
export const EIGHT_D_LIST_STEP_SLOT_PX = 60;
/** 列宽 = 节点条带宽 + 单元格 inline padding 余量，避免 strip 与列宽相等触发横滚 */
export const EIGHT_D_LIST_STAGE_COLUMN_PADDING_BUFFER = 32;
export const EIGHT_D_LIST_STAGE_COLUMN_WIDTH =
  EIGHT_D_STATUS_ORDER.length * EIGHT_D_LIST_STEP_SLOT_PX + EIGHT_D_LIST_STAGE_COLUMN_PADDING_BUFFER;

export function resolveEightDSourceDisplay(
  t: TFunction,
  row: { quality_exception_id?: number | null; defect_record_id?: number | null },
): { label: string; color: string } | null {
  if (row.quality_exception_id) {
    return {
      label: t('app.kuaizhizao.eightD.source.qualityException', { id: row.quality_exception_id }),
      color: 'purple',
    };
  }
  if (row.defect_record_id) {
    return {
      label: t('app.kuaizhizao.eightD.source.nonconformingLedger', { id: row.defect_record_id }),
      color: 'orange',
    };
  }
  return null;
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

/** 8D 严重度徽章：与质量异常列表语义一致（轻微/严重/紧急） */
export function resolveEightDSeverityDisplay(
  t: TFunction,
  severity?: string | null,
): { label: string; color: 'default' | 'processing' | 'warning' | 'error' } {
  const label = getEightDSeverityText(t, severity);
  if (!severity || label === '-') {
    return { label: '-', color: 'default' };
  }
  switch (severity) {
    case 'critical':
      return { label, color: 'error' };
    case 'major':
      return { label, color: 'warning' };
    case 'minor':
      return { label, color: 'processing' };
    default:
      return { label, color: 'default' };
  }
}

/** 解析「D1 组建团队」类阶段标题，供表单标签样式化 */
export function parseEightDStageLabel(text: string): { code: string; title: string } | null {
  const matched = text.trim().match(/^(D\d+)\s*(.+)$/i);
  if (!matched) return null;
  return { code: matched[1].toUpperCase(), title: matched[2] };
}

export function getEightDStageHintKey(status: string): string {
  return `app.kuaizhizao.eightD.stageHint.${status}`;
}

export function getEightDStageIndex(status?: string | null): number {
  if (!status) return -1;
  return EIGHT_D_STATUS_ORDER.indexOf(status as EightDStatus);
}

export type EightDStageUnlockMap = Record<
  string,
  {
    unlocked_at?: string;
    unlocked_by?: number;
    unlocked_by_name?: string;
    reason?: string;
  }
>;

export function isEightDStageUnlocked(
  stageUnlocks: EightDStageUnlockMap | null | undefined,
  stageKey: string,
): boolean {
  return Boolean(stageUnlocks?.[stageKey]);
}

/** 已完成节点：当前阶段之前的节点，或报告已关闭时的全部 D 阶段 */
export function isEightDCompletedStage(
  reportStatus?: string | null,
  stageKey?: string | null,
): boolean {
  if (!reportStatus || !stageKey || stageKey === 'closed') return false;
  if (!EIGHT_D_STAGE_FIELDS[stageKey]) return false;
  if (reportStatus === 'closed') return true;
  const currentIdx = getEightDStageIndex(reportStatus);
  const stageIdx = getEightDStageIndex(stageKey);
  if (currentIdx < 0 || stageIdx < 0) return false;
  return stageIdx < currentIdx;
}

/** 当前阶段可直接编辑；已完成节点须先申请修改解锁 */
export function isEightDStageEditable(
  reportStatus?: string | null,
  stageKey?: string | null,
  stageUnlocks?: EightDStageUnlockMap | null,
): boolean {
  if (!reportStatus || !stageKey || stageKey === 'closed') return false;
  if (reportStatus === 'closed') {
    return isEightDStageUnlocked(stageUnlocks, stageKey);
  }
  const currentIdx = getEightDStageIndex(reportStatus);
  const stageIdx = getEightDStageIndex(stageKey);
  if (currentIdx < 0 || stageIdx < 0) return false;
  if (stageIdx === currentIdx) return true;
  if (stageIdx < currentIdx) {
    return isEightDStageUnlocked(stageUnlocks, stageKey);
  }
  return false;
}

export function canRequestEightDStageUnlock(
  reportStatus?: string | null,
  stageKey?: string | null,
  stageUnlocks?: EightDStageUnlockMap | null,
): boolean {
  return (
    isEightDCompletedStage(reportStatus, stageKey) &&
    !isEightDStageEditable(reportStatus, stageKey, stageUnlocks)
  );
}

/** 列表/摘要区 HTML 正文截断展示 */
export function stripEightDHtml(html?: string | null, maxLength = 80): string {
  if (!html) return '';
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

const EIGHT_D_EMPTY_BLOCK_PATTERN = /<p(?:\s[^>]*)?>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi;
const EIGHT_D_EMPTY_LIST_ITEM_PATTERN = /<li(?:\s[^>]*)?>(?:\s|&nbsp;|<br\s*\/?>)*<\/li>/gi;

/** 去除 Quill 保存时产生的空段落/空列表项，避免只读区出现大块空白 */
export function normalizeEightDStageHtml(html?: string | null): string {
  const raw = (html ?? '').trim();
  if (!raw || raw === '<p><br></p>') return '';
  let normalized = raw;
  let prev = '';
  while (prev !== normalized) {
    prev = normalized;
    normalized = normalized.replace(EIGHT_D_EMPTY_BLOCK_PATTERN, '');
    normalized = normalized.replace(EIGHT_D_EMPTY_LIST_ITEM_PATTERN, '');
  }
  return normalized.trim();
}

const EIGHT_D_HISTORY_LINE_PATTERN =
  /^\[[^\]]+\]\s*(?:[a-z0-9_]+\s*->\s*)?[a-z0-9_]+\s*:/i;

/** 备注字段中剥离系统写入的历程行，仅保留协作说明 */
export function stripEightDHistoryRemarks(remarks?: string | null): string {
  if (!remarks) return '';
  return remarks
    .split('\n')
    .filter((line) => !EIGHT_D_HISTORY_LINE_PATTERN.test(line.trim()))
    .join('\n')
    .trim();
}
