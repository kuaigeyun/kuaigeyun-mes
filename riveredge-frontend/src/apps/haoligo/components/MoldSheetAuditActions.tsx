/**
 * 好力 GO 模具单据行内简易审核（审核通过 / 审核驳回 / 撤销审核）。
 * 不走 UniWorkflowActions、站点 audit-required 或平台审批实例。
 */
import React from 'react';
import { App, Button, Popconfirm, Space } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';
import { CheckOutlined, CloseOutlined, RollbackOutlined } from '@ant-design/icons';
import { useGlobalStore } from '../../../stores/globalStore';
import { canAuditMoldSheet, normalizeMoldSheetAuditStatus } from '../utils/moldSheetStatus';
import { MOLD_SHEET_AUDIT_ACTION_ATTR } from '../constants/moldSheetAudit';

const auditBtnProps = { [MOLD_SHEET_AUDIT_ACTION_ATTR]: '' } as const;

export type MoldSheetAuditHandlers = {
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
  onRevoke?: () => Promise<void>;
};

type BuildParams = {
  canAudit: boolean;
  sheetStatus: string | null | undefined;
  handlers: MoldSheetAuditHandlers;
  messageApi: MessageInstance;
  reload?: () => void;
  /** 为 true 时仅展示「撤销审核」（如试模单已收回），不展示通过/驳回 */
  revokeOnly?: boolean;
};

/** 平铺按钮节点，供 renderRowActionsOverflow 使用（避免组件节点被溢出逻辑丢弃） */
export function buildMoldSheetAuditActionElements({
  canAudit,
  sheetStatus,
  handlers,
  messageApi,
  reload,
  revokeOnly = false,
}: BuildParams): React.ReactNode[] {
  if (!canAudit) return [];

  const st = normalizeMoldSheetAuditStatus(sheetStatus);
  const run = async (fn: () => Promise<void>, okMsg: string) => {
    try {
      await fn();
      messageApi.success(okMsg);
      reload?.();
    } catch (e) {
      messageApi.error((e as Error).message || '操作失败');
    }
  };

  if (st === '待审核' && !revokeOnly) {
    return [
      <Popconfirm
        key="approve"
        title="确认审核通过？"
        onConfirm={() => void run(handlers.onApprove, '已通过审核')}
      >
        <Button type="link" size="small" icon={<CheckOutlined />} {...auditBtnProps}>
          审核通过
        </Button>
      </Popconfirm>,
      <Popconfirm
        key="reject"
        title="确认审核驳回？"
        onConfirm={() => void run(handlers.onReject, '已驳回')}
      >
        <Button type="link" size="small" danger icon={<CloseOutlined />} {...auditBtnProps}>
          审核驳回
        </Button>
      </Popconfirm>,
    ];
  }

  if (st === '已通过' && handlers.onRevoke) {
    return [
      <Popconfirm
        key="revoke"
        title="确认撤销审核？撤销后将回到待审核。"
        onConfirm={() => void run(handlers.onRevoke!, '已撤销审核')}
      >
        <Button type="link" size="small" icon={<RollbackOutlined />} {...auditBtnProps}>
          撤销审核
        </Button>
      </Popconfirm>,
    ];
  }

  return [];
}

type Props = {
  resource: string;
  sheetStatus: string | null | undefined;
  handlers: MoldSheetAuditHandlers;
  reload?: () => void;
  revokeOnly?: boolean;
};

export const MoldSheetAuditActions: React.FC<Props> = ({
  resource,
  sheetStatus,
  handlers,
  reload,
  revokeOnly,
}) => {
  const { message: messageApi } = App.useApp();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const canAudit = canAuditMoldSheet(currentUser, resource);
  const nodes = buildMoldSheetAuditActionElements({
    canAudit,
    sheetStatus,
    handlers,
    messageApi,
    reload,
    revokeOnly,
  });

  if (!nodes.length) return null;
  return <Space size={0}>{nodes}</Space>;
};

