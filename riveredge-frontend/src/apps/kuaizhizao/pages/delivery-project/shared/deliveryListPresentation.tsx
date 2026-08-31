/**
 * 交付项目列表/详情状态与标识展示（StatusTag solid / MarkerTag filled）
 */
import React from 'react';
import { MarkerTag } from '../../../../../constants/statusBadges';
import { renderDocumentStatusTag } from '../../../../../utils/documentLifecycleStatusTag';
import {
  DELIVERY_ISSUE_PRIORITY,
  DELIVERY_ISSUE_TYPE,
} from '../../../services/delivery-project';

/** 流程状态：码 → 中文文案 + 全局配色 */
export function renderDeliveryStatusTag(
  status?: string | null,
  valueEnum?: Record<string, string>,
): React.ReactNode {
  const code = String(status ?? '').trim();
  if (!code) return '-';
  const label = (valueEnum?.[code] ?? code).trim();
  if (!label) return '-';
  return renderDocumentStatusTag(label, code);
}

/** 非状态标识（优先级/类型等） */
export function renderDeliveryMarkerTag(
  text?: string | null,
  color?: string,
): React.ReactNode {
  const value = String(text ?? '').trim();
  if (!value || value === '-' || value === '—') return value || '-';
  return <MarkerTag color={color}>{value}</MarkerTag>;
}

/** 问题优先级：低 / 普通 / 高 / 紧急 */
const ISSUE_PRIORITY_COLOR: Record<string, string> = {
  low: 'default',
  normal: 'processing',
  high: 'warning',
  urgent: 'error',
};

/** 问题类型：阻塞 / 质量 / 交期 / 其他 */
const ISSUE_TYPE_COLOR: Record<string, string> = {
  blocker: 'error',
  quality: 'warning',
  delivery: 'processing',
  other: 'default',
};

export function renderDeliveryIssuePriorityTag(priority?: string | null): React.ReactNode {
  const code = String(priority ?? '').trim();
  if (!code) return '-';
  const label = DELIVERY_ISSUE_PRIORITY[code] ?? code;
  return renderDeliveryMarkerTag(label, ISSUE_PRIORITY_COLOR[code] ?? 'default');
}

export function renderDeliveryIssueTypeTag(issueType?: string | null): React.ReactNode {
  const code = String(issueType ?? '').trim();
  if (!code) return '-';
  const label = DELIVERY_ISSUE_TYPE[code] ?? code;
  return renderDeliveryMarkerTag(label, ISSUE_TYPE_COLOR[code] ?? 'default');
}
