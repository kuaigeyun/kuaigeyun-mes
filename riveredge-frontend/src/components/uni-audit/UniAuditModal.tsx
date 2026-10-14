import React, { useEffect, useMemo, useState } from 'react';

import {

  Modal,

  Typography,

  Space,

  Tag,

  Input,

  Spin,

  Button,

  Empty,

  Row,

  Col,

  Divider,

  Descriptions,

  theme,

  Flex,

  Alert,
  Radio,
  message,

} from 'antd';

import {

  AuditOutlined,

  CheckCircleOutlined,

  CloseCircleOutlined,

  RollbackOutlined,

  UserOutlined,

  ClockCircleOutlined,

} from '@ant-design/icons';

import { getApprovalStatus, type ApprovalStatusResponse } from '../../services/approvalInstance';
import { resolveAuditFlowExecutePermission } from '../../utils/auditFlowViewerGate';
import ApprovalFlowPreview from './ApprovalFlowPreview';
import UniAuditAdvancedActionModal, { type AdvancedActionState } from './UniAuditAdvancedActionModal';
import type { UniAuditAction } from './types';
import { getSessionCurrentUser } from '../../utils/sessionCurrentUser';
import { isAdminBypass, resolveUserForMenuPermission } from '../../utils/permission';
import { formatDateTimeBySiteSetting } from '../../utils/format';
import { useTranslation } from 'react-i18next';
import type { GlobalToken } from 'antd/es/theme/interface';



const { useToken } = theme;

const { Text, Title } = Typography;



export interface UniAuditHubAction {

  action: UniAuditAction;

  title: string;

  canExecute: boolean;

  danger?: boolean;

  primary?: boolean;

  /** 不可执行时的原因（如非当前节点待办人）；优先于通用「无权限」提示 */
  disabledReason?: string;

  /**
   * 模块 RBAC 是否允许该动作。弹窗内用 live viewer_actions 再裁剪执行权。
   * 缺省回退 canExecute（兼容旧调用）。
   */
  rbacAllowed?: boolean;

}



interface UniAuditModalProps {

  open: boolean;

  mode?: 'action' | 'hub';

  action?: UniAuditAction;

  entityName: string;

  actionTitle?: string;

  actionDescription?: string;

  entityType?: string;

  entityId?: number;

  canExecute?: boolean;

  hubActions?: UniAuditHubAction[];

  /** 模块审核 RBAC；列表未带出 approve 项时 reinject 仍须按此门禁 */
  rbacAllowed?: boolean;

  hubTitle?: string;

  onCancel: () => void;

  onConfirm?: (reason?: string) => Promise<void>;

  onAction?: (action: UniAuditAction, reason?: string, payload?: Record<string, unknown>) => Promise<void>;

}



const ACTION_TAG_COLOR: Partial<Record<UniAuditAction, string>> = {

  submit: 'blue',

  withdraw: 'orange',

  approve: 'green',

  reject: 'red',

  revoke: 'volcano',

  transfer: 'cyan',

  add_sign: 'geekblue',

  delegate: 'lime',

  urge: 'gold',

  edit: 'volcano',

};



const NODE_STATUS_LABEL: Record<string, { color: string; text: string }> = {

  pending: { color: 'processing', text: '进行中' },

  approved: { color: 'success', text: '已通过' },

  rejected: { color: 'error', text: '已驳回' },

  waiting: { color: 'default', text: '待到达' },

  skipped: { color: 'warning', text: '已跳过' },

};

function resolveNodeExecutionCardStyle(
  status: string,
  token: GlobalToken,
): { border: string; background: string } {
  switch (status) {
    case 'approved':
      return {
        border: `1px solid ${token.colorSuccessBorder}`,
        background: token.colorSuccessBg,
      };
    case 'rejected':
      return {
        border: `1px solid ${token.colorErrorBorder}`,
        background: token.colorErrorBg,
      };
    case 'pending':
      return {
        border: `1px solid ${token.colorPrimary}`,
        background: token.colorPrimaryBg,
      };
    case 'skipped':
      return {
        border: `1px solid ${token.colorWarningBorder}`,
        background: token.colorWarningBg,
      };
    case 'waiting':
    default:
      return {
        border: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorFillAlter,
      };
  }
}



const EXECUTION_ACTION_LABEL: Record<string, string> = {
  approve: '审核',
  approved: '审核',
  reject: '驳回',
  rejected: '驳回',
  cancel: '撤回提交',
  cancelled: '撤回提交',
  canceled: '撤回提交',
  transfer: '转交',
  transferred: '转交',
  withdraw: '撤回提交',
  withdrawn: '撤回提交',
  submit: '提交',
  submitted: '提交',
  pending: '待处理',
  unknown: '未知操作',
};

const EXECUTION_ACTION_TAG_COLOR: Record<string, string> = {
  approve: 'green',
  approved: 'green',
  reject: 'red',
  rejected: 'red',
  cancel: 'orange',
  cancelled: 'orange',
  canceled: 'orange',
  withdraw: 'orange',
  withdrawn: 'orange',
  revoke: 'volcano',
  revoked: 'volcano',
  submit: 'blue',
  submitted: 'blue',
  transfer: 'cyan',
  transferred: 'cyan',
  pending: 'default',
  unknown: 'default',
};

function formatDateTime(value?: string | null): string {
  return formatDateTimeBySiteSetting(value ?? null);
}

function formatExecutionAction(action?: string | null, actionLabel?: string | null): string {
  if (actionLabel) return actionLabel;
  const key = String(action ?? '').trim().toLowerCase();
  return EXECUTION_ACTION_LABEL[key] || '未知操作';
}

function getExecutionActionTagColor(action?: string | null): string {
  const key = String(action ?? '').trim().toLowerCase();
  return EXECUTION_ACTION_TAG_COLOR[key] ?? 'default';
}

function AuditMetaLabel({
  icon,
  children,
  color,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        color,
        lineHeight: 1.5,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: 14,
          lineHeight: 1,
        }}
      >
        {icon}
      </span>
      <span>{children}</span>
    </span>
  );
}

function AuditHubDetailPanel({

  entityName,

  flowStatus,

  flowLoading,

}: {

  entityName: string;

  flowStatus: ApprovalStatusResponse | null;

  flowLoading: boolean;

}) {

  const { token } = useToken();

  const process = flowStatus?.process;

  const instance = flowStatus?.instance;

  const nodesOverview = flowStatus?.nodes_overview ?? [];



  if (flowLoading) {

    return (

      <div style={{ textAlign: 'center', padding: 48 }}>

        <Spin />

      </div>

    );

  }



  return (

    <Row gutter={16} wrap={false} style={{ minHeight: 360 }}>

      <Col flex="0 0 42%" style={{ minWidth: 0 }}>

        <Space orientation="vertical" size={12} style={{ width: '100%' }}>

          <div>

            <Text type="secondary" style={{ fontSize: 12 }}>

              审核流程

            </Text>

            <Title level={5} style={{ margin: '4px 0 0' }}>

              {process?.name || '未绑定审批流程'}

            </Title>

          </div>

          <ApprovalFlowPreview

            graph={process?.nodes}

            nodesOverview={nodesOverview}

            height={340}

          />

          {!process?.nodes?.nodes?.length && (

            <Text type="secondary">暂无流程图配置</Text>

          )}

        </Space>

      </Col>



      <Col flex="1" style={{ minWidth: 0, borderLeft: `1px solid ${token.colorBorderSecondary}`, paddingLeft: 16 }}>

        <Space orientation="vertical" size={16} style={{ width: '100%' }}>

          <div>

            <Text type="secondary" style={{ fontSize: 12 }}>

              单据

            </Text>

            <Title level={5} style={{ margin: '4px 0 0' }}>

              {entityName}

            </Title>

          </div>



          <Descriptions
            column={1}
            size="small"
            colon={false}
            styles={{
              label: {
                width: 108,
                paddingRight: 16,
                verticalAlign: 'middle',
                whiteSpace: 'nowrap',
              },
              content: {
                verticalAlign: 'middle',
              },
            }}
          >

            <Descriptions.Item
              label={
                <AuditMetaLabel icon={<UserOutlined />} color={token.colorTextSecondary}>
                  发起人员
                </AuditMetaLabel>
              }
            >

              {instance?.submitter_name || '-'}

            </Descriptions.Item>

            <Descriptions.Item
              label={
                <AuditMetaLabel icon={<ClockCircleOutlined />} color={token.colorTextSecondary}>
                  发起时间
                </AuditMetaLabel>
              }
            >

              {formatDateTime(instance?.submitted_at)}

            </Descriptions.Item>

          </Descriptions>



          <Divider style={{ margin: '8px 0' }} />



          <Text strong>节点执行记录</Text>

          {nodesOverview.length === 0 ? (

            <Text type="secondary">暂无审批节点</Text>

          ) : (

            <Space orientation="vertical" size={12} style={{ width: '100%' }}>

              {nodesOverview.map((node) => {

                const statusMeta = NODE_STATUS_LABEL[node.status] || NODE_STATUS_LABEL.waiting;
                const cardStyle = resolveNodeExecutionCardStyle(node.status, token);

                return (

                  <div

                    key={node.node_id}

                    style={{

                      padding: 12,

                      borderRadius: token.borderRadiusLG,

                      border: cardStyle.border,

                      background: cardStyle.background,

                    }}

                  >

                    <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>

                      <Text strong>{node.label}</Text>

                      <Tag color={statusMeta.color} variant="solid">{statusMeta.text}</Tag>

                    </Space>



                    {node.eligible_approvers.length > 0 && (

                      <Flex align="flex-start" gap={8} style={{ marginTop: 10 }}>

                        <Text type="secondary" style={{ fontSize: 12, flexShrink: 0, lineHeight: '22px' }}>

                          可审核人员

                        </Text>

                        <Flex wrap gap={12} style={{ flex: 1, minWidth: 0 }}>

                          {node.eligible_approvers.map((u) => (

                            <span
                              key={u.user_id}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                fontSize: 13,
                                lineHeight: '22px',
                                color: token.colorText,
                              }}
                            >

                              <UserOutlined style={{ fontSize: 12, color: token.colorTextSecondary }} />

                              {u.name}

                            </span>

                          ))}

                        </Flex>

                      </Flex>

                    )}



                    {node.executions.length > 0 ? (

                      <div style={{ marginTop: 8, fontSize: 12 }}>

                        {node.executions.map((ex, idx) => (

                          <div key={`${node.node_id}-ex-${idx}`} style={{ marginBottom: 4 }}>

                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                width: '100%',
                              }}
                            >

                              <Text style={{ fontWeight: 500 }}>

                                {ex.action_by_name || ex.action_by || '系统'}

                              </Text>

                              <Tag color={getExecutionActionTagColor(ex.action)} variant="filled">

                                {formatExecutionAction(ex.action, ex.action_label)}

                              </Tag>

                              <Text type="secondary" style={{ marginLeft: 'auto', flexShrink: 0 }}>

                                {formatDateTime(ex.action_at)}

                              </Text>

                            </div>

                            {ex.comment && (

                              <div>

                                <Text type="secondary">{ex.comment}</Text>

                              </div>

                            )}

                            {ex.field_changes && ex.field_changes.length > 0 && (

                              <ul style={{ margin: '4px 0 0', paddingLeft: 16, color: token.colorTextSecondary }}>

                                {ex.field_changes.map((fc, fi) => (

                                  <li key={fi}>

                                    {fc.label || fc.field}：{fc.from || '—'} → {fc.to || '—'}

                                  </li>

                                ))}

                              </ul>

                            )}

                          </div>

                        ))}

                      </div>

                    ) : (

                      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>

                        暂无执行记录

                      </Text>

                    )}

                  </div>

                );

              })}

            </Space>

          )}

        </Space>

      </Col>

    </Row>

  );

}



export const UniAuditModal: React.FC<UniAuditModalProps> = ({

  open,

  mode = 'action',

  action,

  entityName,

  actionTitle,

  actionDescription,

  entityType,

  entityId,

  canExecute = true,

  hubActions = [],

  rbacAllowed: rbacAllowedProp,

  hubTitle = '审核',

  onCancel,

  onConfirm,

  onAction,

}) => {

  const { t } = useTranslation();
  const [reason, setReason] = useState('');

  const [confirming, setConfirming] = useState(false);

  const [busyAction, setBusyAction] = useState<UniAuditAction | null>(null);

  const [flowLoading, setFlowLoading] = useState(false);

  const [flowStatus, setFlowStatus] = useState<ApprovalStatusResponse | null>(null);

  const [advancedAction, setAdvancedAction] = useState<AdvancedActionState | null>(null);
  /** null=未选择；双分支条件必须显式选是/否，禁止默认跳边 */
  const [branchDecision, setBranchDecision] = useState<boolean | null>(null);

  const sessionUser = resolveUserForMenuPermission(getSessionCurrentUser());
  const adminOpen = isAdminBypass(sessionUser);
  const currentUserId = sessionUser?.id ?? null;

  const { effectiveHubActions, flowAssigneeBlockHint } = useMemo(() => {
    let items = [...hubActions];
    let assigneeBlockHint: string | undefined;
    const flowPending =
      flowStatus?.has_instance && flowStatus.status === 'pending';
    const viewerActions = flowStatus?.viewer_actions;
    const hasMyPendingTask =
      viewerActions?.has_my_pending_task ?? flowStatus?.has_my_pending_task ?? false;

    if (flowPending) {
      const caps = flowStatus.node_capabilities ?? {};
      items = items.map((item) => {
        if (item.action !== 'approve' && item.action !== 'reject') {
          return item;
        }
        const rbacAllowed = item.rbacAllowed ?? rbacAllowedProp ?? item.canExecute;
        const flowPerm = resolveAuditFlowExecutePermission(
          item.action === 'approve' ? 'approve' : 'reject',
          {
            adminBypass: adminOpen,
            rbacAllowed: Boolean(rbacAllowed),
            liveViewerActions: viewerActions ?? null,
            flowPending: true,
          },
        );
        const liveBlockReason =
          flowPerm.blockReason
          || viewerActions?.block_reason
          || (() => {
              const currentNode = (flowStatus.nodes_overview ?? []).find((n) => n.is_current);
              const names = (currentNode?.eligible_approvers ?? [])
                .map((u) => String(u.name || '').trim())
                .filter(Boolean);
              return names.length
                ? t('components.uniAudit.notNodeAssigneeWithNames', { names: names.join('、') })
                : t('components.uniAudit.notNodeAssignee');
            })();
        if (!flowPerm.canExecute && rbacAllowed && !assigneeBlockHint) {
          assigneeBlockHint = liveBlockReason;
        }
        return {
          ...item,
          canExecute: flowPerm.canExecute,
          // 流程已加载时禁止沿用列表态旧 block_reason（节点推进后会误显示上一节点待办人）
          disabledReason: !rbacAllowed
            ? t('components.uniAudit.missingReviewPermission')
            : (flowPerm.canExecute ? undefined : liveBlockReason),
        };
      });
      // 列表若曾裁掉 approve/reject，弹窗在待办补齐后仍须给出审核按钮
      const moduleRbac =
        rbacAllowedProp
        ?? items.find((item) => item.action === 'approve' || item.action === 'reject')?.rbacAllowed
        ?? adminOpen;
      const liveAssigneeOk = adminOpen || Boolean(viewerActions?.approve) || hasMyPendingTask;
      const liveCanApprove = liveAssigneeOk && Boolean(moduleRbac);
      const liveCanReject =
        (adminOpen || Boolean(viewerActions?.reject) || hasMyPendingTask) && Boolean(moduleRbac);
      if (liveCanApprove && !items.some((item) => item.action === 'approve')) {
        items.push({
          action: 'approve',
          title: t('components.uniAudit.approveAction'),
          canExecute: true,
          rbacAllowed: true,
          primary: true,
        });
      }
      if (liveCanReject && !items.some((item) => item.action === 'reject')) {
        items.push({
          action: 'reject',
          title: t('components.uniAudit.rejectAction'),
          canExecute: true,
          rbacAllowed: true,
          danger: true,
        });
      }
      // 列表态 canExecute 可能仍为 false（batch 未补齐待办）；live 确认后抬升可点
      if (liveCanApprove || liveCanReject) {
        items = items.map((item) => {
          if (item.action === 'approve' && liveCanApprove) {
            return { ...item, canExecute: true, rbacAllowed: true };
          }
          if (item.action === 'reject' && liveCanReject) {
            return { ...item, canExecute: true, rbacAllowed: true };
          }
          return item;
        });
      }
      if ((hasMyPendingTask || adminOpen) && caps.allow_transfer) {
        items.push({ action: 'transfer', title: t('components.uniAudit.transfer'), canExecute: true });
      }
      if ((hasMyPendingTask || adminOpen) && caps.allow_add_sign) {
        items.push({ action: 'add_sign', title: t('components.uniAudit.addSign'), canExecute: true });
      }
      if (hasMyPendingTask || adminOpen) {
        items.push({ action: 'delegate', title: t('components.uniAudit.delegate'), canExecute: true });
      }
      const isSubmitter = flowStatus.instance?.submitter_id === currentUserId;
      if (isSubmitter) {
        items.push({ action: 'urge', title: t('components.uniAudit.urge'), canExecute: true });
      }
    }
    return { effectiveHubActions: items, flowAssigneeBlockHint: assigneeBlockHint };
  }, [hubActions, flowStatus, currentUserId, adminOpen, rbacAllowedProp, t]);



  useEffect(() => {

    if (!open) {

      setReason('');

      setBusyAction(null);

      return;

    }

    if (!entityType || !entityId) {

      setFlowStatus(null);

      return;

    }

    let cancelled = false;

    setFlowLoading(true);

    getApprovalStatus(entityType, entityId)

      .then((res) => {

        if (!cancelled) setFlowStatus(res);

      })

      .catch(() => {

        if (!cancelled) setFlowStatus(null);

      })

      .finally(() => {

        if (!cancelled) setFlowLoading(false);

      });

    return () => {

      cancelled = true;

    };

  }, [open, entityType, entityId]);

  const nodeDecision = flowStatus?.current_node_decision;

  useEffect(() => {
    if (!nodeDecision?.field) {
      setBranchDecision(null);
      return;
    }
    // 须显式选择时保持未选；仅当配置了明确默认值时预填
    if (nodeDecision.requireExplicit !== false && nodeDecision.defaultValue == null) {
      setBranchDecision(null);
    } else {
      setBranchDecision(Boolean(nodeDecision.defaultValue));
    }
  }, [nodeDecision?.field, nodeDecision?.defaultValue, nodeDecision?.requireExplicit, open]);

  const buildApprovePayload = (): Record<string, unknown> | undefined => {
    if (!nodeDecision?.field || branchDecision === null) return undefined;
    return {
      instance_data_patch: {
        [nodeDecision.field]: branchDecision,
      },
    };
  };

  const handleOk = async () => {

    if (!onConfirm) return;

    setConfirming(true);

    try {

      await onConfirm(reason.trim() || undefined);

    } finally {

      setConfirming(false);

    }

  };



  const handleHubAction = async (item: UniAuditHubAction) => {

    if (!onAction || !item.canExecute) return;

    if (item.action === 'transfer' || item.action === 'add_sign' || item.action === 'delegate') {
      setAdvancedAction({ action: item.action, open: true });
      return;
    }

    if (item.action === 'approve' && nodeDecision?.field && branchDecision === null) {
      message.warning(
        t('components.uniAudit.branchDecisionRequired', { label: nodeDecision.label }),
      );
      return;
    }

    setBusyAction(item.action);

    try {
      const payload =
        item.action === 'approve' ? buildApprovePayload() : undefined;
      await onAction(
        item.action,
        item.action === 'reject' || item.action === 'urge' ? reason.trim() || undefined : undefined,
        payload,
      );

    } finally {

      setBusyAction(null);

    }

  };



  const simpleFlowHint = useMemo(() => {

    if (flowLoading || flowStatus?.process?.nodes?.nodes?.length) return null;

    if (flowStatus?.has_flow) {

      return '当前使用单据审核绑定流程；若未配置节点图，请在「审批流程」设计器中完善。';

    }

    return '当前单据未启用平台审批流，将执行单据审核生命周期操作。';

  }, [flowLoading, flowStatus]);



  if (mode === 'hub') {

    const hasReject = effectiveHubActions.some((a) => a.action === 'reject');

    return (

      <Modal

        open={open}

        title={hubTitle}

        onCancel={onCancel}

        footer={null}

        width={960}

        destroyOnHidden

        styles={{ body: { paddingTop: 12 } }}

      >

        <AuditHubDetailPanel

          entityName={entityName}

          flowStatus={flowStatus}

          flowLoading={flowLoading}

        />



        {simpleFlowHint && (

          <Text type="secondary" style={{ display: 'block', marginTop: 12, fontSize: 12 }}>

            {simpleFlowHint}

          </Text>

        )}



        <Divider style={{ margin: '16px 0' }} />



        {hasReject && (

          <Input.TextArea

            value={reason}

            onChange={(e) => setReason(e.target.value)}

            rows={3}

            placeholder="如需驳回，请输入驳回原因（可选）"

            style={{ marginBottom: 12 }}

          />

        )}



        {flowAssigneeBlockHint ? (

          <Alert

            type="info"

            showIcon

            title={flowAssigneeBlockHint}

            style={{ marginBottom: 12 }}

          />

        ) : null}

        {nodeDecision && effectiveHubActions.some((a) => a.action === 'approve' && a.canExecute) ? (
          <div
            style={{
              marginBottom: 12,
              padding: '10px 12px',
              border: '1px solid rgba(0, 0, 0, 0.06)',
              borderRadius: 6,
              background: '#f7f8fa',
            }}
          >
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              {nodeDecision.label}
            </Text>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
              {t('components.uniAudit.branchDecisionHint')}
            </Text>
            <Radio.Group
              value={
                branchDecision === null ? undefined : branchDecision ? 'true' : 'false'
              }
              onChange={(e) => setBranchDecision(e.target.value === 'true')}
              buttonStyle="solid"
            >
              <Radio.Button value="true">
                {t('components.uniAudit.branchDecisionYes', {
                  name: nodeDecision.trueBranchLabel || t('common.yes'),
                })}
              </Radio.Button>
              <Radio.Button value="false">
                {t('components.uniAudit.branchDecisionNo', {
                  name: nodeDecision.falseBranchLabel || t('common.no'),
                })}
              </Radio.Button>
            </Radio.Group>
          </div>
        ) : null}

        {effectiveHubActions.length > 0 ? (

          <Flex justify="space-between" align="center" wrap="wrap" gap={8}>

            <Space wrap>

            {effectiveHubActions.map((item) => (

              <Button

                key={item.action}

                type={item.primary ? 'primary' : 'default'}

                danger={item.danger}

                disabled={!item.canExecute}

                loading={busyAction === item.action}

                title={item.canExecute ? undefined : (item.disabledReason || t('components.uniAudit.noPermission'))}

                icon={

                  item.action === 'approve' ? <CheckCircleOutlined />

                    : item.action === 'reject' ? <CloseCircleOutlined />

                      : item.action === 'withdraw' ? <RollbackOutlined />

                        : <AuditOutlined />

                }

                onClick={() => handleHubAction(item)}

              >

                {item.title}

              </Button>

            ))}

            </Space>

            <Button onClick={onCancel}>{t('common.close')}</Button>

          </Flex>

        ) : (

          <>

            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前阶段没有可执行的审核操作" />

            <Flex justify="flex-end" style={{ marginTop: 12 }}>

              <Button onClick={onCancel}>{t('common.close')}</Button>

            </Flex>

          </>

        )}

        <UniAuditAdvancedActionModal
          state={advancedAction}
          onClose={() => setAdvancedAction(null)}
          onConfirm={async (action, payload, cmt) => {
            if (!onAction) return;
            setBusyAction(action);
            try {
              await onAction(action, cmt, payload);
              if (entityType && entityId) {
                const res = await getApprovalStatus(entityType, entityId);
                setFlowStatus(res);
              }
            } finally {
              setBusyAction(null);
            }
          }}
        />

      </Modal>

    );

  }



  return (

    <Modal

      open={open}

      title={canExecute ? actionTitle : `审核 - ${actionTitle}`}

      onCancel={onCancel}

      onOk={handleOk}

      okText={actionTitle}

      cancelText={canExecute ? '取消' : '关闭'}

      okButtonProps={{ disabled: !canExecute }}

      confirmLoading={confirming}

      width={720}

      destroyOnHidden

    >

      <Space orientation="vertical" style={{ width: '100%' }} size={12}>

        <Space>

          <Typography.Text strong>{entityName}</Typography.Text>

          {action && <Tag color={ACTION_TAG_COLOR[action]} variant="solid">{actionTitle}</Tag>}

        </Space>

        {actionDescription && <Typography.Text type="secondary">{actionDescription}</Typography.Text>}

        {!canExecute && (

          <Typography.Text type="warning">{t('components.uniAudit.noPermission')}</Typography.Text>

        )}

        {canExecute && action === 'reject' && (

          <Input.TextArea

            value={reason}

            onChange={(e) => setReason(e.target.value)}

            rows={4}

            placeholder="请输入驳回原因（可选）"

          />

        )}

        <AuditHubDetailPanel

          entityName={entityName}

          flowStatus={flowStatus}

          flowLoading={flowLoading}

        />

      </Space>

    </Modal>

  );

};



export default UniAuditModal;


