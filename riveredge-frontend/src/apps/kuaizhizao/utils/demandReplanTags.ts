/**
 * 需求变更（重排任务）列表徽章：模式/风险为 MarkerTag（filled）；审批与任务执行为 StatusTag（solid，右固定）。
 */

import React from 'react';
import { MarkerTag, StatusTag } from '../../../constants/statusBadges';

export const DEMAND_REPLAN_RISK_MARKER_COLOR: Record<string, string> = {
  low: 'success',
  medium: 'warning',
  high: 'error',
};

export const DEMAND_REPLAN_TASK_STATUS_COLOR: Record<string, string> = {
  pending: 'default',
  running: 'processing',
  completed: 'success',
  failed: 'error',
  cancelled: 'default',
};

export const DEMAND_REPLAN_APPROVAL_STATUS_COLOR: Record<string, string> = {
  not_required: 'default',
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
};

export const DEMAND_REPLAN_MODE_MARKER_COLOR: Record<string, string> = {
  net_change: 'geekblue',
  full_regen: 'purple',
  what_if: 'cyan',
};

export function getDemandReplanModeMarkerColor(mode?: string | null): string {
  return DEMAND_REPLAN_MODE_MARKER_COLOR[String(mode ?? '').trim()] ?? 'default';
}

export function renderDemandReplanModeMarker(
  label: string,
  mode?: string | null,
): React.ReactNode {
  if (!label || label === '-') return '-';
  return React.createElement(MarkerTag, { color: getDemandReplanModeMarkerColor(mode) }, label);
}

export function renderDemandReplanRiskMarker(
  label: string,
  riskLevel?: string | null,
): React.ReactNode {
  if (!label || label === '-') return '-';
  const key = String(riskLevel ?? '').trim();
  return React.createElement(
    MarkerTag,
    { color: DEMAND_REPLAN_RISK_MARKER_COLOR[key] ?? 'default' },
    label,
  );
}

export function renderDemandReplanApprovalStatusTag(
  label: string,
  status?: string | null,
): React.ReactNode {
  if (!label || label === '-') return '-';
  const key = String(status ?? '').trim();
  return React.createElement(
    StatusTag,
    { color: DEMAND_REPLAN_APPROVAL_STATUS_COLOR[key] ?? 'default' },
    label,
  );
}

export function renderDemandReplanTaskStatusTag(
  label: string,
  status?: string | null,
): React.ReactNode {
  if (!label || label === '-') return '-';
  const key = String(status ?? '').trim();
  return React.createElement(
    StatusTag,
    { color: DEMAND_REPLAN_TASK_STATUS_COLOR[key] ?? 'default' },
    label,
  );
}

export function renderDemandReplanEventStatusTag(
  label: string,
  status?: string | null,
): React.ReactNode {
  if (!label || label === '-') return '-';
  const key = String(status ?? '').trim();
  const color =
    key === 'analyzed' ? 'success' : key === 'failed' ? 'error' : 'default';
  return React.createElement(StatusTag, { color }, label);
}
