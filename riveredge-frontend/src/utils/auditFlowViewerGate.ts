/**
 * 审批流查看者门控（行内审核 / 批量审核 / 审核弹窗唯一真源）。
 * 与后端 ``approval_viewer_actions.build_flow_viewer_actions``、``record.audit.viewer_actions`` 对齐。
 */

import type { AuditStateLike } from './auditMode';
import type { ApprovalFlowViewerActions } from '../services/approvalInstance';

export type AuditFlowGatedAction = 'approve' | 'reject';

const FLOW_GATED_ACTIONS = new Set<AuditFlowGatedAction>(['approve', 'reject']);

export function readAuditViewerActions(
  audit?: AuditStateLike | null,
): ApprovalFlowViewerActions | undefined {
  if (!audit || typeof audit !== 'object') return undefined;
  const raw = (audit as { viewer_actions?: ApprovalFlowViewerActions }).viewer_actions;
  if (!raw || typeof raw !== 'object') return undefined;
  return raw;
}

export function auditFlowGateApplies(audit?: AuditStateLike | null): boolean {
  if (!audit || typeof audit !== 'object') return false;
  return audit.phase === 'pending' && audit.enabled !== false && audit.mode !== 'auto';
}

/**
 * 是否允许执行 approve/reject（RBAC 通过后再看流程待办）。
 * ``liveViewerActions`` 为弹窗内 getApprovalStatus 结果，优先于 record.audit.viewer_actions。
 */
export function resolveAuditFlowExecutePermission(
  action: AuditFlowGatedAction,
  opts: {
    adminBypass: boolean;
    rbacAllowed: boolean;
    audit?: AuditStateLike | null;
    liveViewerActions?: ApprovalFlowViewerActions | null;
    /** 弹窗内已确认存在 pending 流程实例时使用 */
    flowPending?: boolean;
  },
): { canExecute: boolean; blockReason?: string } {
  if (opts.adminBypass) {
    return { canExecute: true };
  }
  if (!opts.rbacAllowed) {
    return { canExecute: false };
  }
  const gateActive = opts.flowPending === true || auditFlowGateApplies(opts.audit);
  if (!gateActive) {
    return { canExecute: true };
  }

  const viewerActions = opts.liveViewerActions ?? readAuditViewerActions(opts.audit);
  if (!viewerActions) {
    return { canExecute: true };
  }

  const flowOk = action === 'approve' ? Boolean(viewerActions.approve) : Boolean(viewerActions.reject);
  return {
    canExecute: flowOk,
    blockReason: flowOk ? undefined : viewerActions.block_reason ?? undefined,
  };
}

/** 批量/行内 capabilities 解析：有 viewer_actions 时覆盖 approve/reject。 */
export function auditFlowCapabilityOverride(
  record: {
    audit?: AuditStateLike | null;
    capabilities?: Record<string, { allowed?: boolean; reason?: string | null } | undefined> | null;
  },
  capabilityKey: string,
): { allowed: boolean; reason?: string | null } | undefined {
  const auditAction =
    capabilityKey === 'approve'
      ? 'approve'
      : capabilityKey === 'reject'
        ? 'reject'
        : null;
  if (!auditAction || !auditFlowGateApplies(record.audit)) {
    return undefined;
  }
  const viewerActions = readAuditViewerActions(record.audit);
  if (!viewerActions) {
    return undefined;
  }
  const flowOk =
    auditAction === 'approve' ? Boolean(viewerActions.approve) : Boolean(viewerActions.reject);
  if (flowOk) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: viewerActions.block_reason ?? null,
  };
}

export function isAuditActionInAllowedList(
  audit: AuditStateLike | null | undefined,
  action: string,
): boolean {
  const allowed = audit?.allowed_actions;
  if (!Array.isArray(allowed)) return false;
  return allowed.includes(action);
}

export function batchAuditActionAllowed(
  record: {
    capabilities?: Record<string, { allowed?: boolean } | undefined> | null;
    audit?: AuditStateLike | null;
  },
  capabilityKey: string,
  permAllowed: boolean,
): boolean {
  if (!permAllowed) return false;
  const flowOverride = auditFlowCapabilityOverride(record, capabilityKey);
  if (flowOverride !== undefined) {
    return flowOverride.allowed;
  }
  const cap = record.capabilities?.[capabilityKey];
  if (cap != null) {
    return cap.allowed === true;
  }
  const auditActionMap: Record<string, string> = {
    submit: 'submit',
    withdraw_submit: 'withdraw',
    approve: 'approve',
    revoke_approval: 'revoke',
  };
  const auditAction = auditActionMap[capabilityKey];
  if (!auditAction) return false;
  return isAuditActionInAllowedList(record.audit, auditAction);
}
