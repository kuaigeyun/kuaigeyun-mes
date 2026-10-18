/**
 * 审核模式语义（与后端 audit_phase.py 一致）
 *
 * - manual（enabled=true）：人工审批流，提交后 pending，需 approve/reject
 * - auto（enabled=false）：审核关闭 = **自动通过**，提交后写入已通过态，仍展示 audit.phase
 *
 * 禁止将 auditEnabled=false 理解为「跳过审核 / 不展示审核列」。
 */

export type AuditWorkflowMode = 'manual' | 'auto';

export type AuditActionType = 'submit' | 'withdraw' | 'approve' | 'reject' | 'revoke' | 'recall_own';

export interface AuditViewerActionsLike {
  has_my_pending_task?: boolean;
  approve?: boolean;
  reject?: boolean;
  /** 当前人已通过本单某一级，且当前节点不再是他的待办 */
  my_acted?: boolean;
  block_reason?: string | null;
}

export interface AuditStateLike {
  phase?: string;
  enabled?: boolean;
  mode?: string;
  allowed_actions?: string[];
  entity_type?: string;
  viewer_actions?: AuditViewerActionsLike;
  viewer_can_revoke?: boolean;
  viewer_can_withdraw_submit?: boolean;
  viewer_can_recall_own?: boolean;
}

export interface AuditActionVisibility {
  /** 是否由 record.audit.allowed_actions 驱动（与审核列同源） */
  authoritative: boolean;
  allowedActions: string[];
  manualAuditEnabled: boolean;
  showSubmit: boolean;
  showWithdraw: boolean;
  showApprove: boolean;
  showReject: boolean;
  showRevoke: boolean;
  showRecallOwn: boolean;
  showAuditHub: boolean;
}

export interface AuditActionVisibilityFallback {
  isDraft?: boolean;
  isPending?: boolean;
  isApproved?: boolean;
  isRejected?: boolean;
  manualAuditEnabled?: boolean;
}

/** 是否启用人工审批流（= useAuditRequired / record.audit.enabled） */
export function isManualAuditEnabled(audit?: AuditStateLike | null): boolean {
  if (!audit) return false;
  if (audit.mode === 'auto') return false;
  if (audit.mode === 'manual') return true;
  return audit.enabled !== false;
}

/** 是否为自动通过模式（审核关闭） */
export function isAutoApproveAuditMode(audit?: AuditStateLike | null): boolean {
  return !isManualAuditEnabled(audit);
}

function includesAuditAction(allowedActions: string[], action: AuditActionType): boolean {
  return allowedActions.includes(action);
}

/**
 * 审核行内操作可见性（与审核列 record.audit 同源）。
 * 有 audit.phase 时仅看 allowed_actions；无 audit 时走 status 兜底（遗留列表）。
 */
export function resolveAuditActionVisibility(
  audit?: AuditStateLike | null,
  fallback?: AuditActionVisibilityFallback,
): AuditActionVisibility {
  if (audit && typeof audit === 'object' && typeof audit.phase === 'string') {
    const allowedActions = Array.isArray(audit.allowed_actions) ? audit.allowed_actions : [];
    const manualAuditEnabled = isManualAuditEnabled(audit);
    const flowWithdraw =
      includesAuditAction(allowedActions, 'withdraw')
      && audit.viewer_can_withdraw_submit !== false;
    const flowRevoke =
      includesAuditAction(allowedActions, 'revoke')
      && audit.viewer_can_revoke !== false;
    const flowRecallOwn = includesAuditAction(allowedActions, 'recall_own');
    return {
      authoritative: true,
      allowedActions,
      manualAuditEnabled,
      showSubmit: includesAuditAction(allowedActions, 'submit'),
      showWithdraw: flowWithdraw,
      showApprove: includesAuditAction(allowedActions, 'approve'),
      showReject: includesAuditAction(allowedActions, 'reject'),
      showRevoke: flowRevoke,
      showRecallOwn: flowRecallOwn,
      showAuditHub:
        flowWithdraw
        || flowRecallOwn
        || includesAuditAction(allowedActions, 'approve')
        || includesAuditAction(allowedActions, 'reject'),
    };
  }

  const manualAuditEnabled = fallback?.manualAuditEnabled ?? false;
  const isDraft = Boolean(fallback?.isDraft);
  const isPending = Boolean(fallback?.isPending);
  const isApproved = Boolean(fallback?.isApproved);
  const isRejected = Boolean(fallback?.isRejected);

  return {
    authoritative: false,
    allowedActions: [],
    manualAuditEnabled,
    showSubmit: isDraft || isRejected,
    showWithdraw: manualAuditEnabled && isPending,
    showApprove: manualAuditEnabled && isPending,
    showReject: manualAuditEnabled && isPending,
    showRevoke: isApproved,
    showRecallOwn: false,
    showAuditHub: manualAuditEnabled && isPending,
  };
}

export function hasVisibleAuditRowActions(visibility: AuditActionVisibility): boolean {
  return (
    visibility.showSubmit
    || visibility.showWithdraw
    || visibility.showApprove
    || visibility.showReject
    || visibility.showRevoke
    || visibility.showRecallOwn
  );
}
