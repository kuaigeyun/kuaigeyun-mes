/**
 * 详情弹窗底栏：审核操作 + 关闭
 */
import React from 'react';
import { Button, Space } from 'antd';
import { MoldSheetAuditActions, type MoldSheetAuditHandlers } from './MoldSheetAuditActions';

type Props = {
  resource: string;
  sheetStatus: string | null | undefined;
  handlers: MoldSheetAuditHandlers;
  onClose: () => void;
  onReload?: () => void;
};

export const MoldSheetDetailAuditFooter: React.FC<Props> = ({
  resource,
  sheetStatus,
  handlers,
  onClose,
  onReload,
}) => (
  <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
    <Space wrap>
      <MoldSheetAuditActions
        resource={resource}
        sheetStatus={sheetStatus}
        handlers={handlers}
        reload={onReload}
      />
      <Button onClick={onClose}>关闭</Button>
    </Space>
  </div>
);
