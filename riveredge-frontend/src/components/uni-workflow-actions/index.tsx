import React, { useState } from 'react';
import { Space, Button, Modal, App, Input } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, SendOutlined, UndoOutlined } from '@ant-design/icons';
import { apiRequest } from '../../services/api';
import { useAuditRequired } from '../../hooks/useAuditRequired';

export type WorkflowStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'cancelled' | string;

export interface UniWorkflowActionsProps {
  /** 单据记录 */
  record: any;
  /** 单据的主键名称，默认为 id */
  rowKey?: string;
  /** 单据类型关联的 API 前缀，例如 /apps/kuaizhizao/sales/orders */
  apiPrefix?: string;
  /** 
   * 手动传入各动作的方法，优先级高于 apiPrefix。
   * 如果涉及特殊的传参或已经定义好的 service 方法，建议通过此处传入
   */
  actions?: {
    /** 提交方法 */
    submit?: (id: number) => Promise<any>;
    /** 审批或者自动通过的方法 */
    approve?: (id: number) => Promise<any>;
    /** 驳回方法，支持接收驳回原因 */
    reject?: (id: number, reason?: string) => Promise<any>;
    /** 撤销审核的方法 */
    revoke?: (id: number) => Promise<any>;
  };
  /** 单据类型的中文描述，例如“销售订单” */
  entityName?: string;
  /** 状态字段名，默认 status */
  statusField?: string;
  /** 取消审核的状态字段名（有些系统叫 review_status） */
  reviewStatusField?: string;
  /** 处于草稿对应的值数组 */
  draftStatuses?: string[];
  /** 处于待审核对应的值数组 */
  pendingStatuses?: string[];
  /** 处于已审核对应的值数组 */
  approvedStatuses?: string[];
  /** 处于已驳回对应的值数组 */
  rejectedStatuses?: string[];

  /** 当系统设置为提交后自动审核通过时，是否隐藏“提交”内部逻辑，改为直接调用 approve */
  autoApproveWhenSubmit?: boolean;
  /** 当前单据是否启用审核流程（关闭后隐藏审核相关按钮/文案） */
  workflowAuditEnabled?: boolean;
  /** 审核流程节点 key（如 sales_order / purchase_order）；未传时尝试按 apiPrefix 推断 */
  auditNodeKey?: string;

  /** 提交按钮与确认弹窗中的动作名称，默认「提交」（如采购订单可用「提交审核」） */
  submitActionLabel?: string;

  /** 成功操作后的回调（通常用于刷新表格或详情） */
  onSuccess?: () => void;
  /** 是否以 Button.Group (紧凑模式) 或 Button type="link" (表格行模式) 渲染 */
  theme?: 'default' | 'link';
  /** 透传的尺寸属性 */
  size?: 'small' | 'middle' | 'large';
  /** 支持外部传入确认弹窗文本 */
  confirmMessages?: {
    submit?: string;
    approve?: string;
    reject?: string;
    revoke?: string;
  };
}

/**
 * 统一的单据工作流操作区
 *
 * 自动根据单据的 `status` 决定呈现的按钮（提交、审批、驳回、撤销）。
 * 内置二次弹窗及标准的 API REST 调用逻辑，支持自定义 actions。
 */
export const UniWorkflowActions: React.FC<UniWorkflowActionsProps> = ({
  record,
  rowKey = 'id',
  apiPrefix,
  actions = {},
  entityName = '单据',
  statusField = 'status',
  reviewStatusField = 'review_status',
  draftStatuses = ['draft', '草稿'],
  pendingStatuses = ['pending_approval', 'pending_review', '待审核'],
  approvedStatuses = ['approved', 'audited', '已审核', '审核通过'],
  rejectedStatuses = ['rejected', '已驳回'],
  autoApproveWhenSubmit = false,
  workflowAuditEnabled,
  auditNodeKey,
  submitActionLabel = '提交',
  onSuccess,
  theme = 'default',
  size = 'middle',
  confirmMessages = {},
}) => {
  const { message } = App.useApp();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const inferNodeKey = (): string => {
    if (auditNodeKey) return auditNodeKey;
    const prefix = (apiPrefix ?? '').toLowerCase();
    if (prefix.includes('/sales/orders')) return 'sales_order';
    if (prefix.includes('/sales/forecasts')) return 'sales_forecast';
    if (prefix.includes('/purchase/orders')) return 'purchase_order';
    if (prefix.includes('/purchase/requisitions')) return 'purchase_request';
    if (prefix.includes('/plan/production-plans')) return 'production_plan';
    if (prefix.includes('/quality/') && prefix.includes('inspection')) return 'quality_inspection';
    if (prefix.includes('/sales/delivery') || prefix.includes('/delivery-notice')) return 'sales_delivery';
    if (prefix.includes('/demands')) return 'demand';
    if (prefix.includes('/quotation')) return 'quotation';
    return '';
  };
  const inferredNodeKey = inferNodeKey();
  const inferredAuditEnabled = useAuditRequired(inferredNodeKey, false);
  const effectiveAuditEnabled = workflowAuditEnabled ?? (inferredNodeKey ? inferredAuditEnabled : false);

  if (!record || !record[rowKey]) return null;
  const status = record[statusField];
  const reviewStatus = record[reviewStatusField];

  const doApiCall = async (actionType: 'submit' | 'approve' | 'reject' | 'revoke', reason?: string) => {
    const id = record[rowKey];
    if (actions[actionType]) {
      return (actions[actionType] as Function)(id, reason);
    }
    if (apiPrefix) {
      const endpoint = actionType === 'revoke' ? 'unapprove' : actionType;
      // 驳回时可能需要理由
      return apiRequest(`${apiPrefix}/${id}/${endpoint}`, {
        method: 'POST',
        params: reason ? { rejection_reason: reason } : undefined,
      });
    }
    throw new Error(`未配置 ${actionType} 操作对应的 API`);
  };

  const handleAction = (action: 'submit' | 'approve' | 'revoke', actionName: string) => {
    // 处理提交时的自动审核逻辑
    let actualActionName = actionName;

    if (action === 'submit' && autoApproveWhenSubmit) {
       actualActionName = effectiveAuditEnabled
         ? `${actionName}（将自动审批通过）`
         : `${actionName}（将自动生效）`;
    }

    const content = confirmMessages[action] || `确定要 ${actualActionName} 这个${entityName}吗？`;

    Modal.confirm({
      title: `${actionName}${entityName}`,
      content,
      onOk: async () => {
        setLoadingAction(action);
        try {
          // 如果启用自动审核，且当前动作是提交，我们依次调用 submit 然后 approve，或者根据业务需要。
          // 这里提供一个封装的约定：如果启用了 autoApproveWhenSubmit，外部在 submit actions 中自己负责处理 approve
          // 或者统一抛给外层的 actions.submit
          const res = await doApiCall(action);
          
          if (res?.demand_synced) {
            message.success(`${actualActionName}成功，已同步至关联需求。`);
          } else {
             message.success(`${actualActionName}成功`);
          }
          
          onSuccess?.();
        } catch (error: any) {
          message.error(`${actionName}失败: ${error.message || '未知错误'}`);
        } finally {
          setLoadingAction(null);
        }
      },
    });
  };

  const handleReject = () => {
    let reason = '';
    Modal.confirm({
      title: `驳回${entityName}`,
      content: (
        <div>
          <p>{confirmMessages.reject || `请输入驳回 ${entityName} 的原因：`}</p>
          <Input.TextArea
            rows={4}
            onChange={(e) => { reason = e.target.value; }}
            placeholder="驳回原因（可选）"
          />
        </div>
      ),
      onOk: async () => {
        setLoadingAction('reject');
        try {
          await doApiCall('reject', reason);
          message.success('已驳回');
          onSuccess?.();
        } catch (error: any) {
          message.error(`驳回失败: ${error.message || '未知错误'}`);
        } finally {
          setLoadingAction(null);
        }
      },
    });
  };

  const isLink = theme === 'link';
  const getBtnProps = (actionType: string) => ({
    type: isLink ? ('link' as const) : ('default' as const),
    size,
    loading: loadingAction === actionType,
    disabled: !!loadingAction && loadingAction !== actionType,
  });

  const isDraft = draftStatuses.includes(status) || draftStatuses.includes(reviewStatus);
  const isPending = pendingStatuses.includes(status) || pendingStatuses.includes(reviewStatus);
  const isApproved = approvedStatuses.includes(status) || approvedStatuses.includes(reviewStatus);
  const isRejected = rejectedStatuses.includes(status) || rejectedStatuses.includes(reviewStatus);
  const approveLabel = effectiveAuditEnabled ? '审核' : '确认';
  const revokeLabel = effectiveAuditEnabled ? '撤销审核' : '撤销确认';

  return (
    <Space>
      {(isDraft || isRejected) && (actions.submit || apiPrefix) && (
        <Button
          key="submit"
          {...getBtnProps('submit')}
          icon={<SendOutlined />}
          onClick={() => handleAction('submit', submitActionLabel)}
        >
          {submitActionLabel}
        </Button>
      )}

      {isPending && (actions.approve || apiPrefix) && (
        <Button
          key="approve"
          {...getBtnProps('approve')}
          icon={<CheckCircleOutlined />}
          onClick={() => handleAction('approve', approveLabel)}
        >
          {approveLabel}
        </Button>
      )}
      {effectiveAuditEnabled && isPending && (actions.approve || apiPrefix) && (actions.reject || apiPrefix) && (
        <Button
          key="reject"
          {...getBtnProps('reject')}
          danger
          icon={<CloseCircleOutlined />}
          onClick={handleReject}
        >
          驳回
        </Button>
      )}

      {effectiveAuditEnabled && isApproved && (actions.revoke || apiPrefix) && (
        <Button
          key="revoke"
          {...getBtnProps('revoke')}
          danger={!isLink}
          icon={<UndoOutlined />}
          onClick={() => handleAction('revoke', revokeLabel)}
        >
          {revokeLabel}
        </Button>
      )}
    </Space>
  );
};

export default UniWorkflowActions;
