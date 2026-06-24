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

export const QUALITY_LINE_STOP_OVERDUE_HINT = {
  quality: '品质异常停线：逾期将提醒生产部长、品质部长',
  equipment: '设备异常停线：逾期将提醒生产部长、工程部长',
} as const;
