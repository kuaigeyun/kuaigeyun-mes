/**
 * 好力 GO 模具单据行内简易审核（审核通过 / 审核驳回 / 撤销审核）。
 * 不走 UniWorkflowActions、站点 audit-required 或平台审批实例。
 */
import React from 'react';
import { rowActionKind } from '../../../components/uni-action';
import { App, Button, Dropdown, Modal, Popconfirm, Space } from 'antd';
import type { MenuProps } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';
import {
  AuditOutlined,
  CheckOutlined,
  CloseOutlined,
  DownOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
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

/** 平铺按钮节点，供 UniTable 操作列使用（避免组件节点被溢出逻辑丢弃） */
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
      throw e;
    }
  };

  if (st === '待审核' && !revokeOnly) {
    const menuItems: MenuProps['items'] = [
      {
        key: 'approve',
        icon: <CheckOutlined />,
        label: '审核通过',
        onClick: () => {
          Modal.confirm({
            title: '确认审核通过？',
            okText: '确认',
            cancelText: '取消',
            onOk: () => run(handlers.onApprove, '已通过审核'),
          });
        },
      },
      {
        key: 'reject',
        danger: true,
        icon: <CloseOutlined />,
        label: '审核驳回',
        onClick: () => {
          Modal.confirm({
            title: '确认审核驳回？',
            okText: '确认',
            cancelText: '取消',
            okButtonProps: { danger: true },
            onOk: () => run(handlers.onReject, '已驳回'),
          });
        },
      },
    ];
    return [
      <Dropdown {...rowActionKind('skip')} key="audit" menu={{ items: menuItems }} trigger={['click']}>
        <Button type="link" size="small" icon={<AuditOutlined />} {...auditBtnProps}>
          审核
          <DownOutlined style={{ fontSize: 10, marginLeft: 2 }} />
        </Button>
      </Dropdown>,
    ];
  }

  if (st === '已通过' && handlers.onRevoke) {
    return [
      <Popconfirm {...rowActionKind('revoke')}
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

