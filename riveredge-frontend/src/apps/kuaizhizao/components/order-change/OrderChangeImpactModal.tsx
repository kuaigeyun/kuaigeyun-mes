import React from 'react';
import { Alert, Descriptions, List, Modal, Tag } from 'antd';
import type { ChangeImpactPreview } from '../../services/sales-order-change';

interface OrderChangeImpactModalProps {
  open: boolean;
  loading?: boolean;
  impact: ChangeImpactPreview | null;
  onClose: () => void;
  onConfirm?: () => void;
  confirmText?: string;
}

export const OrderChangeImpactModal: React.FC<OrderChangeImpactModalProps> = ({
  open,
  loading,
  impact,
  onClose,
  onConfirm,
  confirmText = '确认提交',
}) => {
  const blocking = impact?.blocking_errors ?? [];
  const canProceed = blocking.length === 0;

  const renderList = (title: string, items?: Array<Record<string, unknown>>) => {
    if (!items?.length) return null;
    return (
      <List
        size="small"
        header={title}
        dataSource={items}
        renderItem={(item) => (
          <List.Item>
            <Tag>{String(item.code ?? item.id ?? '-')}</Tag>
            {String(item.name ?? '')}
            {item.status ? <Tag style={{ marginLeft: 8 }}>{String(item.status)}</Tag> : null}
          </List.Item>
        )}
      />
    );
  };

  return (
    <Modal
      title="变更影响预览"
      open={open}
      onCancel={onClose}
      onOk={canProceed ? onConfirm : undefined}
      okText={confirmText}
      okButtonProps={{ disabled: !canProceed, loading }}
      width={720}
      destroyOnHidden
    >
      {blocking.length > 0 && (
        <Alert type="error" showIcon message="存在阻断项" description={blocking.join('；')} style={{ marginBottom: 16 }} />
      )}
      {(impact?.recommended_actions?.length ?? 0) > 0 && (
        <Descriptions size="small" column={1} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="建议操作">
            {(impact?.recommended_actions ?? []).join('、')}
          </Descriptions.Item>
        </Descriptions>
      )}
      {renderList('受影响需求', impact?.affected_demands)}
      {renderList('受影响需求计算', impact?.affected_computations)}
      {renderList('受影响生产计划', impact?.affected_plans)}
      {renderList('受影响工单', impact?.affected_work_orders)}
      {renderList('受影响收货通知', impact?.affected_receipt_notices)}
      {renderList('受影响入库单', impact?.affected_inbounds)}
      {!impact && !loading && <Alert type="info" message="暂无影响数据" />}
    </Modal>
  );
};
