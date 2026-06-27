import React, { useMemo, useState } from 'react';
import { App, Button, Space } from 'antd';
import { AuditOutlined, RollbackOutlined, SendOutlined } from '@ant-design/icons';
import { apiRequest } from '../../services/api';
import { prepareRowActionButton, rowActionKind, type RowActionPermissionKind } from '../uni-action';
import { rowActionLabel } from '../uni-action/actionCatalog';
import { useAuditRequired } from '../../hooks/useAuditRequired';
import { isManualAuditEnabled, resolveAuditActionVisibility } from '../../utils/auditMode';
import { useGlobalStore } from '../../stores';
import { hasModulePermission, hasReviewPermission } from '../../utils/permissionContract';
import { isAdminBypass, resolveUserForMenuPermission } from '../../utils/permission';
import UniAuditModal, { type UniAuditHubAction } from './UniAuditModal';
import type { UniAuditAction, UniAuditActionsMap, UniAuditEndpointMap, WorkflowStatus } from './types';

const DEFAULT_ENDPOINTS: Record<UniAuditAction, string> = {
  submit: 'submit',
  withdraw: 'withdraw',
  approve: 'approve',
  reject: 'reject',
  revoke: 'unapprove',
};

export interface UniAuditActionsProps {
  record: any;
  rowKey?: string;
  apiPrefix?: string;
  actions?: UniAuditActionsMap;
  endpointMap?: UniAuditEndpointMap;
  entityName?: string;
  entityType?: string;
  statusField?: string;
  reviewStatusField?: string;
  draftStatuses?: string[];
  pendingStatuses?: string[];
  approvedStatuses?: string[];
  rejectedStatuses?: string[];
  /** @deprecated 由 record.audit.mode 决定，无需传入 */
  autoApproveWhenSubmit?: boolean;
  /** @deprecated 由 record.audit.enabled/mode 决定，无需传入 */
  workflowAuditEnabled?: boolean;
  auditNodeKey?: string;
  submitActionLabel?: string;
  onSuccess?: () => void;
  theme?: 'default' | 'link';
  size?: 'small' | 'middle' | 'large';
  confirmMessages?: Partial<Record<UniAuditAction, string>>;
  resourcePrefix?: string;
  unifiedAudit?: boolean;
}

function inferAuditNodeKey(apiPrefix?: string): string {
  const prefix = (apiPrefix ?? '').toLowerCase();
  if (prefix.includes('/sales/contracts')) return 'sales_contract';
  if (prefix.includes('/sales/orders')) return 'sales_order';
  if (prefix.includes('/sales/forecasts')) return 'sales_forecast';
  if (prefix.includes('/purchase/orders')) return 'purchase_order';
  if (prefix.includes('/purchase/requisitions')) return 'purchase_request';
  if (prefix.includes('/purchase/inquiries')) return 'purchase_inquiry';
  if (prefix.includes('/purchase/order-changes')) return 'purchase_order_change';
  if (prefix.includes('/sales/order-changes')) return 'sales_order_change';
  if (prefix.includes('/plan/production-plans')) return 'production_plan';
  if (prefix.includes('/quality/oqc-inspection')) return 'oqc_inspection';
  if (prefix.includes('/quality/incoming-inspection')) return 'incoming_inspection';
  if (prefix.includes('/quality/process-inspection')) return 'process_inspection';
  if (prefix.includes('/quality/finished-goods-inspection')) return 'finished_goods_inspection';
  if (prefix.includes('/productions/reporting') || prefix.includes('/reporting')) return 'reporting_record';
  if (prefix.includes('/demands')) return 'demand';
  if (prefix.includes('/quotation')) return 'quotation';
  if (prefix.includes('/shipment-notices')) return 'shipment_notice';
  return '';
}

function inferResourcePrefix(apiPrefix?: string): string {
  const prefix = (apiPrefix ?? '').toLowerCase();
  if (!prefix) return '';
  if (prefix.includes('/apps/kuaizhizao/sales/contracts')) return 'kuaizhizao:sales-contract';
  if (prefix.includes('/apps/kuaizhizao/sales/orders')) return 'kuaizhizao:sales-order';
  if (prefix.includes('/apps/kuaizhizao/sales/forecasts')) return 'kuaizhizao:sales-forecast';
  if (prefix.includes('/apps/kuaizhizao/sales/order-changes')) return 'kuaizhizao:sales-order-change';
  if (prefix.includes('/apps/kuaizhizao/purchase/orders')) return 'kuaizhizao:purchase-order';
  if (prefix.includes('/apps/kuaizhizao/purchase/requisitions')) return 'kuaizhizao:purchase-request';
  if (prefix.includes('/apps/kuaizhizao/purchase/inquiries')) return 'kuaizhizao:purchase-inquiry';
  if (prefix.includes('/apps/kuaizhizao/purchase/order-changes')) return 'kuaizhizao:purchase-order-change';
  if (prefix.includes('/apps/kuaizhizao/plan/production-plans')) return 'kuaizhizao:production-plan';
  if (prefix.includes('/apps/kuaizhizao/plan/demands')) return 'kuaizhizao:demand';
  if (prefix.includes('/apps/kuaizhizao/productions/reporting')) return 'kuaizhizao:reporting-record';
  if (prefix.includes('/apps/kuaizhizao/quality/oqc-inspection')) return 'kuaizhizao:oqc-inspection';
  if (prefix.includes('/apps/kuaizhizao/quality/incoming-inspection')) return 'kuaizhizao:incoming-inspection';
  if (prefix.includes('/apps/kuaizhizao/quality/process-inspection')) return 'kuaizhizao:process-inspection';
  if (prefix.includes('/apps/kuaizhizao/quality/finished-goods-inspection')) return 'kuaizhizao:finished-goods-inspection';
  if (prefix.includes('/apps/kuaizhizao/shipment-notices')) return 'kuaizhizao:shipment-notice';
  if (prefix.includes('/apps/kuaicaiwu/finance/receivables')) return 'kuaicaiwu:receivable';
  if (prefix.includes('/apps/kuaicaiwu/finance/payables')) return 'kuaicaiwu:payable';
  if (prefix.includes('/apps/kuaicaiwu/finance/purchase-invoices')) return 'kuaicaiwu:purchase-invoice';
  return '';
}

function inferResourceByNodeKey(nodeKey?: string): string {
  const node = (nodeKey || '').trim().toLowerCase();
  if (!node) return '';
  const map: Record<string, string> = {
    sales_contract: 'kuaizhizao:sales-contract',
    sales_order: 'kuaizhizao:sales-order',
    sales_forecast: 'kuaizhizao:sales-forecast',
    sales_order_change: 'kuaizhizao:sales-order-change',
    purchase_order: 'kuaizhizao:purchase-order',
    purchase_request: 'kuaizhizao:purchase-request',
    purchase_inquiry: 'kuaizhizao:purchase-inquiry',
    purchase_order_change: 'kuaizhizao:purchase-order-change',
    production_plan: 'kuaizhizao:production-plan',
    demand: 'kuaizhizao:demand',
    reporting_record: 'kuaizhizao:reporting-record',
    quotation: 'kuaizhizao:quotation',
    incoming_inspection: 'kuaizhizao:incoming-inspection',
    process_inspection: 'kuaizhizao:process-inspection',
    finished_goods_inspection: 'kuaizhizao:finished-goods-inspection',
    quality_inspection: 'kuaizhizao:quality-inspection',
    oqc_inspection: 'kuaizhizao:oqc-inspection',
    shipment_notice: 'kuaizhizao:shipment-notice',
    sales_delivery: 'kuaizhizao:outbound',
    receivable: 'kuaicaiwu:receivable',
    payable: 'kuaicaiwu:payable',
    bom_change: 'kuaiplm:change',
    process_route_change: 'kuaiplm:change',
  };
  return map[node] || '';
}

function normalizeStatusValue(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function matchesAnyStatus(value: unknown, candidates: string[]): boolean {
  const current = normalizeStatusValue(value);
  if (!current) return false;
  return candidates.some((candidate) => normalizeStatusValue(candidate) === current);
}

function usesUnifiedAuditForAction(
  action: UniAuditAction,
  opts: {
    unifiedAudit: boolean;
    resolvedEntityType: string;
    actions: UniAuditActionsMap;
    apiPrefix?: string;
  },
): boolean {
  if (opts.unifiedAudit) return true;
  if (!opts.resolvedEntityType || opts.apiPrefix) return false;
  return !opts.actions[action];
}

export const UniAuditActions: React.FC<UniAuditActionsProps> = ({
  record,
  rowKey = 'id',
  apiPrefix,
  actions = {},
  endpointMap,
  entityName = '单据',
  entityType,
  statusField = 'status',
  reviewStatusField = 'review_status',
  draftStatuses = ['draft', '草稿'],
  pendingStatuses = ['pending_approval', 'pending_review', '待审核'],
  approvedStatuses = ['approved', 'audited', 'confirmed', '已审核', '已确认', '审核通过'],
  rejectedStatuses = ['rejected', '已驳回'],
  workflowAuditEnabled,
  auditNodeKey,
  submitActionLabel = '提交',
  onSuccess,
  theme = 'link',
  size,
  confirmMessages = {},
  resourcePrefix,
  unifiedAudit = false,
}) => {
  const { message } = App.useApp();
  const [loadingAction, setLoadingAction] = useState<UniAuditAction | null>(null);
  const [activeAction, setActiveAction] = useState<UniAuditAction | null>(null);
  const [auditHubOpen, setAuditHubOpen] = useState(false);
  const rawCurrentUser = useGlobalStore((s) => s.currentUser);
  const currentUser = useMemo(() => resolveUserForMenuPermission(rawCurrentUser), [rawCurrentUser]);
  const adminOpen = isAdminBypass(currentUser);

  const inferredNodeKey = useMemo(() => auditNodeKey || inferAuditNodeKey(apiPrefix), [auditNodeKey, apiPrefix]);

  const auditState =
    record?.audit && typeof record.audit === 'object' && typeof record.audit.phase === 'string'
      ? (record.audit as { phase: string; enabled?: boolean; allowed_actions?: string[]; entity_type?: string })
      : null;
  const auditEntityType = (auditState?.entity_type || '').trim();
  const resolvedEntityType = entityType || inferredNodeKey || auditEntityType;

  const inferredAuditEnabled = useAuditRequired(inferredNodeKey || auditEntityType, false);
  const fallbackManualAuditEnabled = workflowAuditEnabled ?? (resolvedEntityType ? inferredAuditEnabled : false);
  const resolvedResource = (
    resourcePrefix
    || inferResourcePrefix(apiPrefix)
    || inferResourceByNodeKey(resolvedEntityType)
  ).trim();
  const hasActionResource = Boolean(resolvedResource);

  const canSubmit = adminOpen || (hasActionResource && hasModulePermission(currentUser ?? undefined, resolvedResource, 'submit'));
  const canReview = adminOpen || (hasActionResource && hasReviewPermission(currentUser ?? undefined, resolvedResource));
  const canRevoke = adminOpen || (hasActionResource && hasModulePermission(currentUser ?? undefined, resolvedResource, 'revoke'));

  const status = (record?.[statusField] ?? undefined) as WorkflowStatus;
  const reviewStatus = (record?.[reviewStatusField] ?? undefined) as WorkflowStatus;
  const recordId = (record?.[rowKey] ?? 0) as number;

  const auditAuthoritative = Boolean(auditState);

  const isDraft = matchesAnyStatus(status, draftStatuses) || matchesAnyStatus(reviewStatus, draftStatuses);
  const isPending = matchesAnyStatus(status, pendingStatuses) || matchesAnyStatus(reviewStatus, pendingStatuses);
  const isApproved = matchesAnyStatus(status, approvedStatuses) || matchesAnyStatus(reviewStatus, approvedStatuses);
  const isRejected = matchesAnyStatus(status, rejectedStatuses) || matchesAnyStatus(reviewStatus, rejectedStatuses);

  const actionVisibility = resolveAuditActionVisibility(auditState, {
    isDraft,
    isPending,
    isApproved,
    isRejected,
    manualAuditEnabled: auditState
      ? isManualAuditEnabled(auditState)
      : fallbackManualAuditEnabled,
  });

  const {
    allowedActions,
    manualAuditEnabled: auditFeatureEnabled,
    showSubmit,
    showWithdraw,
    showApprove,
    showReject,
    showRevoke,
    showAuditHub,
  } = actionVisibility;

  const unifiedOpts = {
    unifiedAudit,
    resolvedEntityType,
    actions,
    apiPrefix,
  };
  const routeViaUnified = (action: UniAuditAction) =>
    usesUnifiedAuditForAction(action, unifiedOpts);

  const channelByAction: Record<UniAuditAction, boolean> = {
    submit:
      routeViaUnified('submit')
      || (auditAuthoritative && Boolean(resolvedEntityType))
      || Boolean(actions.submit)
      || Boolean(apiPrefix),
    withdraw:
      routeViaUnified('withdraw')
      || (auditAuthoritative && Boolean(resolvedEntityType))
      || Boolean(actions.withdraw)
      || Boolean(endpointMap?.withdraw),
    approve:
      routeViaUnified('approve')
      || (auditAuthoritative && Boolean(resolvedEntityType))
      || Boolean(actions.approve)
      || Boolean(apiPrefix),
    reject:
      routeViaUnified('reject')
      || (auditAuthoritative && Boolean(resolvedEntityType))
      || Boolean(actions.reject)
      || Boolean(apiPrefix),
    revoke:
      routeViaUnified('revoke')
      || (auditAuthoritative && Boolean(resolvedEntityType))
      || Boolean(actions.revoke)
      || Boolean(apiPrefix),
  };
  const canExecuteByAction: Record<UniAuditAction, boolean> = {
    submit: canSubmit,
    withdraw: canSubmit,
    approve: canReview,
    reject: canReview,
    revoke: canRevoke,
  };

  const enabledForLabels = auditFeatureEnabled;
  const approveLabel = enabledForLabels ? '审核' : '确认';
  const effectiveSubmitLabel = !enabledForLabels && submitActionLabel.includes('审核')
    ? submitActionLabel.replace(/审核/g, '').trim() || '提交'
    : submitActionLabel;

  const resolvedEndpoints = {
    ...DEFAULT_ENDPOINTS,
    ...(endpointMap || {}),
  };

  const hubActions = useMemo((): UniAuditHubAction[] => {
    const items: UniAuditHubAction[] = [];
    if (showWithdraw && channelByAction.withdraw) {
      items.push({ action: 'withdraw', title: '撤回提交', canExecute: canExecuteByAction.withdraw });
    }
    if (showApprove && channelByAction.approve) {
      items.push({
        action: 'approve',
        title: approveLabel,
        canExecute: canExecuteByAction.approve,
        primary: true,
      });
    }
    if (showReject && channelByAction.reject) {
      items.push({
        action: 'reject',
        title: '驳回',
        canExecute: canExecuteByAction.reject,
        danger: true,
      });
    }
    return items;
  }, [
    showWithdraw,
    showApprove,
    showReject,
    channelByAction.withdraw,
    channelByAction.approve,
    channelByAction.reject,
    canExecuteByAction.withdraw,
    canExecuteByAction.approve,
    canExecuteByAction.reject,
    approveLabel,
  ]);

  const doApiCall = async (
    actionType: UniAuditAction,
    reason?: string,
    payload?: Record<string, unknown>,
  ) => {
    if (
      routeViaUnified(actionType)
      || (auditAuthoritative && Boolean(resolvedEntityType))
    ) {
      if (!resolvedEntityType) {
        throw new Error('统一执行入口需要 entityType 或 auditNodeKey');
      }
      const data = { ...(payload || {}), ...(reason ? { reason } : {}) };
      return apiRequest(`/core/uni-audit/${resolvedEntityType}/${recordId}/${actionType}`, {
        method: 'POST',
        data,
      });
    }
    if (actions[actionType]) {
      const fn = actions[actionType] as (...args: unknown[]) => Promise<unknown>;
      if (payload && (actionType === 'transfer' || actionType === 'add_sign' || actionType === 'delegate')) {
        return fn(recordId, payload, reason);
      }
      return fn(recordId, reason);
    }
    if (!apiPrefix) {
      throw new Error(`未配置 ${actionType} 操作对应的 API`);
    }
    const endpoint = resolvedEndpoints[actionType];
    return apiRequest(`${apiPrefix}/${recordId}/${endpoint}`, {
      method: 'POST',
      params: reason ? { rejection_reason: reason } : undefined,
    });
  };

  const openActionModal = (action: UniAuditAction) => setActiveAction(action);

  const getActionTitle = (action: UniAuditAction): string => {
    if (action === 'submit') return effectiveSubmitLabel;
    if (action === 'approve') return approveLabel;
    if (action === 'reject') return '驳回';
    if (action === 'revoke') return rowActionLabel('revoke');
    if (action === 'transfer') return '转交';
    if (action === 'add_sign') return '加签';
    if (action === 'delegate') return '委托';
    if (action === 'urge') return '催办';
    if (action === 'withdraw') return '撤回提交';
    return '操作';
  };

  const canRunAction = (action: UniAuditAction): boolean => {
    if (adminOpen) return true;
    if (action === 'urge') return canSubmit;
    if (action === 'transfer' || action === 'add_sign' || action === 'delegate') return canReview;
    return Boolean(canExecuteByAction[action as keyof typeof canExecuteByAction]);
  };

  const runAction = async (
    action: UniAuditAction,
    reason?: string,
    payload?: Record<string, unknown>,
  ) => {
    if (!canRunAction(action)) {
      message.warning('您没有该操作权限，仅可查看审核流程');
      return;
    }
    setLoadingAction(action);
    try {
      const res = await doApiCall(action, reason, payload);
      if (res?.demand_synced) {
        message.success(`${getActionTitle(action)}成功，已同步关联需求。`);
      } else {
        message.success(`${getActionTitle(action)}成功`);
      }
      setActiveAction(null);
      setAuditHubOpen(false);
      onSuccess?.();
    } catch (error: any) {
      message.error(`${getActionTitle(action)}失败: ${error.message || '未知错误'}`);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleConfirm = async (reason?: string) => {
    if (!activeAction) return;
    await runAction(activeAction, reason);
  };

  const handleHubAction = async (
    action: UniAuditAction,
    reason?: string,
    payload?: Record<string, unknown>,
  ) => {
    await runAction(action, reason, payload);
  };

  const isBusy = !!loadingAction;
  const submitUsesCustomLabel = effectiveSubmitLabel !== '提交';

  const isToolbarTheme = theme === 'default';
  const btnSize = size ?? (isToolbarTheme ? 'middle' : 'small');

  const renderActionButton = (
    kind: RowActionPermissionKind,
    config: {
      key: string;
      label?: string;
      labelKeep?: boolean;
      loading?: boolean;
      disabled?: boolean;
      onClick: () => void;
      danger?: boolean;
    },
  ) => {
    if (!isToolbarTheme) {
      return prepareRowActionButton(kind, {
        key: config.key,
        labelKeep: config.labelKeep,
        loading: config.loading,
        disabled: config.disabled,
        onClick: config.onClick,
        children: config.label,
      });
    }
    const iconByKind: Partial<Record<RowActionPermissionKind, React.ReactNode>> = {
      submit: <SendOutlined />,
      audit: <AuditOutlined />,
      revoke: <RollbackOutlined />,
    };
    const text =
      config.labelKeep && config.label
        ? config.label
        : config.label ?? rowActionLabel(kind);
    return (
      <Button
        key={config.key}
        {...rowActionKind(kind)}
        size={btnSize}
        type="default"
        danger={config.danger}
        icon={iconByKind[kind]}
        loading={config.loading}
        disabled={config.disabled}
        onClick={config.onClick}
      >
        {text}
      </Button>
    );
  };

  if (!record || !record[rowKey]) return null;

  const inlineButtons: React.ReactNode[] = [];

  if (showSubmit && channelByAction.submit) {
    inlineButtons.push(
      renderActionButton('submit', {
        key: 'audit-submit',
        label: effectiveSubmitLabel,
        labelKeep: submitUsesCustomLabel,
        loading: loadingAction === 'submit',
        disabled: isBusy && loadingAction !== 'submit',
        onClick: () => openActionModal('submit'),
      }),
    );
  }

  if (showAuditHub) {
    inlineButtons.push(
      renderActionButton('audit', {
        key: 'audit-hub',
        loading: isBusy && auditHubOpen,
        disabled: isBusy && !auditHubOpen,
        onClick: () => setAuditHubOpen(true),
      }),
    );
  }

  if (showRevoke && channelByAction.revoke) {
    inlineButtons.push(
      renderActionButton('revoke', {
        key: 'audit-revoke',
        loading: loadingAction === 'revoke',
        disabled: isBusy && loadingAction !== 'revoke',
        onClick: () => openActionModal('revoke'),
      }),
    );
  }

  if (inlineButtons.length === 0) return null;

  return (
    <>
      <Space {...rowActionKind('skip')} size={isToolbarTheme ? 8 : 4} align="center">
        {inlineButtons}
      </Space>

      {auditHubOpen && (
        <UniAuditModal
          open
          mode="hub"
          hubTitle="审核"
          entityName={entityName}
          entityType={resolvedEntityType || undefined}
          entityId={recordId}
          hubActions={hubActions}
          onCancel={() => setAuditHubOpen(false)}
          onAction={handleHubAction}
        />
      )}

      {activeAction && (
        <UniAuditModal
          open
          action={activeAction}
          entityName={entityName}
          actionTitle={getActionTitle(activeAction)}
          actionDescription={
            confirmMessages[activeAction]
              || `确定要${getActionTitle(activeAction)}这个${entityName}吗？`
          }
          entityType={resolvedEntityType || undefined}
          entityId={recordId}
          canExecute={canExecuteByAction[activeAction]}
          onCancel={() => setActiveAction(null)}
          onConfirm={handleConfirm}
        />
      )}
    </>
  );
};

export type { WorkflowStatus, UniAuditAction, UniAuditActionsMap, UniAuditEndpointMap } from './types';
export default UniAuditActions;
