/**
 * 审核相位展示（列表独立列 / 详情区块）
 * 数据源：record.audit.phase（由 audit_phase.py 派生）
 *
 * 审核关闭（audit.enabled=false / mode=auto）= 提交后自动通过，仍须展示相位，不得显示为「无审核」。
 */

import React from 'react';
import { Tag } from 'antd';
import { useTranslation } from 'react-i18next';

export type AuditPhase = 'draft' | 'pending' | 'approved' | 'rejected' | 'none' | string;

export type AuditMode = 'manual' | 'auto' | string;

export interface AuditPhaseRecord {
  audit?: {
    phase?: AuditPhase;
    /** 是否启用人工审批流；false = 自动通过模式 */
    enabled?: boolean;
    mode?: AuditMode;
  } | null;
}

const PHASE_I18N: Record<string, string> = {
  draft: 'components.uniAudit.phaseDraft',
  pending: 'components.uniAudit.phasePending',
  approved: 'components.uniAudit.phaseApproved',
  rejected: 'components.uniAudit.phaseRejected',
  none: 'components.uniAudit.phaseNone',
};

const PHASE_COLOR: Record<string, string> = {
  draft: 'default',
  pending: 'processing',
  approved: 'success',
  rejected: 'error',
  none: 'default',
};

const PHASE_FALLBACK: Record<string, string> = {
  draft: '草稿',
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回',
  none: '—',
};

export interface AuditPhaseBadgeProps {
  record: AuditPhaseRecord | null | undefined;
  /**
   * @deprecated 仅保留兼容；展示不再因「审核关闭」而隐藏（关闭=自动通过，仍展示 phase）。
   */
  auditEnabled?: boolean;
  variant?: 'column' | 'inline';
}

/** 从 record.audit 读取相位（忽略 enabled，关闭审核时仍展示） */
export function resolveAuditPhase(record: AuditPhaseRecord | null | undefined): string {
  const phase = String(record?.audit?.phase ?? 'none').trim().toLowerCase();
  return phase || 'none';
}

export function AuditPhaseBadge({
  record,
  variant = 'column',
}: AuditPhaseBadgeProps) {
  const { t } = useTranslation();

  const audit = record?.audit;
  if (!audit) {
    return variant === 'column' ? <span>—</span> : null;
  }

  const phase = resolveAuditPhase(record);

  if (variant === 'inline' && (phase === 'none' || phase === 'approved')) {
    return null;
  }

  if (phase === 'none') {
    return variant === 'column' ? <span>—</span> : null;
  }

  const i18nKey = PHASE_I18N[phase];
  const label = i18nKey
    ? t(i18nKey, { defaultValue: PHASE_FALLBACK[phase] ?? phase })
    : (PHASE_FALLBACK[phase] ?? phase);
  const color = PHASE_COLOR[phase] ?? 'default';

  return <Tag color={color}>{label}</Tag>;
}
