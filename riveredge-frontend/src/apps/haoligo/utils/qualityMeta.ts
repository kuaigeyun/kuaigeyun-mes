import type { TagProps } from 'antd';

export type QualityWorkflowAction = 'submit' | 'complete';

export function qualityStatusText(status: string | null | undefined): string {
  const s = (status || '').trim().toLowerCase();
  if (s === 'registered') return '已登记';
  if (s === 'assigned') return '待处理';
  if (s === 'processing') return '处理中';
  if (s === 'completed') return '已完成';
  return status || '未知';
}

export function qualityStatusTagColor(status: string | null | undefined): TagProps['color'] {
  const s = (status || '').trim().toLowerCase();
  if (s === 'registered') return 'default';
  if (s === 'assigned') return 'warning';
  if (s === 'processing') return 'warning';
  if (s === 'completed') return 'success';
  return 'default';
}

export function resolveQualityWorkflowAction(status: string | null | undefined): QualityWorkflowAction | null {
  const s = (status || '').trim().toLowerCase();
  if (s === 'registered') return 'submit';
  if (s === 'assigned' || s === 'processing') return 'complete';
  return null;
}

export function qualityWorkflowActionText(action: QualityWorkflowAction): string {
  if (action === 'submit') return '登记并通知';
  return '处理完成';
}

export const QUALITY_NOTIFICATION_DOCUMENT = {
  issue: 'haoligo_quality_issue_tracking',
  complaint: 'haoligo_customer_complaint',
  lineStop: 'haoligo_line_stop_feedback',
} as const;

export const QUALITY_OVERDUE_MINISTER_KEYWORDS = ['品质部长', '生产部长', '工程部长'] as const;

export type QualityIssueKind = 'equipment' | 'product';

export const QUALITY_LINE_STOP_OVERDUE_HINT = {
  quality: '品质异常停线：逾期将提醒生产部长、品质部长',
  equipment: '设备异常停线：逾期将提醒生产部长、工程部长',
} as const;

export type QualityLineStopKind = 'equipment' | 'quality';

export const QUALITY_LINE_STOP_KIND_OPTIONS = [
  { label: '设备异常停线', value: 'equipment' },
  { label: '品质异常停线', value: 'quality' },
] as const;

export const QUALITY_LINE_STOP_OVERDUE_MINISTER_KEYWORDS: Record<QualityLineStopKind, readonly string[]> = {
  quality: ['生产部长', '品质部长'],
  equipment: ['生产部长', '工程部长'],
};

export const QUALITY_COMPLAINT_OVERDUE_MINISTER_KEYWORDS = ['品质部长', '生产部长', '工程部长'] as const;

export function resolveQualityLineStopOverdueMinisterKeywords(
  stopKind: string | null | undefined,
): readonly string[] {
  const key = (stopKind === 'quality' ? 'quality' : 'equipment') as QualityLineStopKind;
  return QUALITY_LINE_STOP_OVERDUE_MINISTER_KEYWORDS[key];
}

export function qualityLineStopOverdueNotifyHint(stopKind: string | null | undefined): string {
  const keywords = resolveQualityLineStopOverdueMinisterKeywords(stopKind).join('、');
  return `预计完成时间次日起未办结时将提醒${keywords}，可在列表「${QUALITY_OVERDUE_NOTIFY_SETTING_TOOLBAR_LABEL}」调整提醒对象`;
}

export function qualityComplaintOverdueNotifyHint(): string {
  const keywords = QUALITY_COMPLAINT_OVERDUE_MINISTER_KEYWORDS.join('、');
  return `预计完成时间次日起未办结时将提醒${keywords}，可在列表「${QUALITY_OVERDUE_NOTIFY_SETTING_TOOLBAR_LABEL}」调整提醒对象`;
}

/** 品质问题处理：按问题类型默认逾期提醒部长关键词 */
export const QUALITY_ISSUE_OVERDUE_MINISTER_KEYWORDS: Record<QualityIssueKind, readonly string[]> = {
  equipment: ['工程部长', '品质部长'],
  product: ['生产部长', '品质部长'],
};

/** 品质问题登记：问题类型（设备 / 产品） */
export const QUALITY_ISSUE_KIND_OPTIONS = [
  { label: '设备品质问题', value: 'equipment' },
  { label: '产品品质问题', value: 'product' },
] as const;

export function resolveQualityIssueOverdueMinisterKeywords(
  issueKind: string | null | undefined,
): readonly string[] {
  const key = (issueKind || '').trim() as QualityIssueKind;
  return QUALITY_ISSUE_OVERDUE_MINISTER_KEYWORDS[key] ?? QUALITY_OVERDUE_MINISTER_KEYWORDS;
}

export function qualityIssueOverdueNotifyHint(issueKind: string | null | undefined): string {
  const keywords = resolveQualityIssueOverdueMinisterKeywords(issueKind).join('、');
  return `预计完成时间次日起未办结时将提醒${keywords}，可在列表「${QUALITY_OVERDUE_NOTIFY_SETTING_TOOLBAR_LABEL}」调整提醒对象`;
}

/** 品质问题处理：按问题类型的固定逾期提醒人设定说明（全量规则） */
export function qualityIssueOverdueNotifySettingDetail(): string {
  return QUALITY_ISSUE_KIND_OPTIONS
    .map((opt) => {
      const keywords = QUALITY_ISSUE_OVERDUE_MINISTER_KEYWORDS[opt.value].join('、');
      return `${opt.label}：${keywords}`;
    })
    .join('；');
}

export const QUALITY_ISSUE_OVERDUE_NOTIFY_SETTING_TEXT = `设定：根据问题类型设定固定逾期提醒人（${qualityIssueOverdueNotifySettingDetail()}）`;

/** 品质问题登记：责任人字段展示名（PC / 手机端一致） */
export const QUALITY_ISSUE_RESPONSIBLE_USER_LABEL = '车间品质/工程负责人';

/** 品质问题登记：通知人字段展示名（PC / 手机端一致） */
export const QUALITY_ISSUE_NOTIFY_USER_LABEL = '问题发现人';

/** 客户投诉登记：通知人字段展示名（PC / 手机端一致） */
export const QUALITY_COMPLAINT_NOTIFY_USER_LABEL = '问题发现人';

/** 停线反馈登记：通知人字段展示名（PC / 手机端一致） */
export const QUALITY_LINE_STOP_NOTIFY_USER_LABEL = '问题发现人';

export function qualityIssueKindLabel(value: string | null | undefined): string {
  const key = (value || '').trim();
  const match = QUALITY_ISSUE_KIND_OPTIONS.find((item) => item.value === key);
  return match?.label ?? (key || '—');
}

/** 措施预计完成时间次日起算逾期（与后端扫描一致） */
export const QUALITY_OVERDUE_GRACE_DAYS = 1;

export const QUALITY_OVERDUE_NOTIFY_HINT =
  '预计完成时间次日起未办结时将提醒以下对象，默认含品质/生产/工程部长';

/** 列表工具栏：固定逾期提醒人设定按钮文案 */
export const QUALITY_OVERDUE_NOTIFY_SETTING_TOOLBAR_LABEL = '逾期提醒设定';

export const QUALITY_LINE_STOP_OVERDUE_NOTIFY_HINT =
  '预计完成时间次日起未办结时将按停线类型提醒对应部长，可在下方调整提醒对象';

/** 停线反馈登记：责任人字段展示名（PC / 手机端一致） */
export const QUALITY_LINE_STOP_RESPONSIBLE_USER_LABEL = '问题处理负责人';

export { calcQualityIssueDefectRate, formatQualityIssueDefectRate } from './qualityIssueQty';
