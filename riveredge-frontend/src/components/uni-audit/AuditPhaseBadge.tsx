/**
 * 审核相位展示（列表独立列 / 详情区块）
 * 数据源：record.audit.phase（由 audit_phase.py 派生）
 *
 * 审核关闭（audit.enabled=false / mode=auto）= 提交后自动通过，仍须展示相位，不得显示为「无审核」。
 * 配色与执行状态同一真源：`constants/documentStatusColors.ts`（待审核=warning，与生命周期「待审核」同色）。
 */

import React from 'react';
import { Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { DOCUMENT_STATUS_SEMANTIC_COLOR, resolveAuditPhaseTagColor } from '../../constants/documentStatusColors';
import { StatusTag } from '../../constants/statusBadges';

export type AuditPhase = 'draft' | 'pending' | 'approved' | 'rejected' | 'none' | string;

export type AuditMode = 'manual' | 'auto' | string;

export interface AuditPhaseRecord {
  audit?: {
    phase?: AuditPhase;
    /** 是否启用人工审批流；false = 自动通过模式 */
    enabled?: boolean;
    mode?: AuditMode;
    viewer_actions?: {
      has_my_pending_task?: boolean;
      approve?: boolean;
      /** 当前登录人已通过本单某一级，且不再持有当前待办 */
      my_acted?: boolean;
      block_reason?: string | null;
    } | null;
  } | null;
}

const PHASE_I18N: Record<string, string> = {
  draft: 'components.uniAudit.phaseDraft',
  pending: 'components.uniAudit.phasePending',
  approved: 'components.uniAudit.phaseApproved',
  rejected: 'components.uniAudit.phaseRejected',
  none: 'components.uniAudit.phaseNone',
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
  /** 展示形态：列居中 / 详情行内（非 Tag 的 solid/filled） */
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

  const viewer = audit.viewer_actions;
  const mine = Boolean(viewer?.approve || viewer?.has_my_pending_task);
  const acted = Boolean(viewer?.my_acted) && !mine;

  let label: string;
  let color = resolveAuditPhaseTagColor(phase);
  let hint: string | undefined;

  if (phase === 'pending' && acted) {
    label = t('components.uniAudit.youAudited', { defaultValue: '您已审核' });
    color = DOCUMENT_STATUS_SEMANTIC_COLOR.success;
    hint = viewer?.block_reason || t('components.uniAudit.youAuditedWaiting', {
      defaultValue: '您已完成本级审核，等待后续节点',
    });
  } else if (phase === 'pending' && mine) {
    label = t('components.uniAudit.phasePendingMine', { defaultValue: '待我审核' });
    color = DOCUMENT_STATUS_SEMANTIC_COLOR.active;
  } else {
    const i18nKey = PHASE_I18N[phase];
    label = i18nKey
      ? t(i18nKey, { defaultValue: PHASE_FALLBACK[phase] ?? phase })
      : (PHASE_FALLBACK[phase] ?? phase);
    if (phase === 'pending' && viewer?.block_reason) {
      hint = viewer.block_reason;
    }
  }

  const tag = <StatusTag color={color}>{label}</StatusTag>;
  if (!hint) return tag;
  return <Tooltip title={hint}><span>{tag}</span></Tooltip>;
}
