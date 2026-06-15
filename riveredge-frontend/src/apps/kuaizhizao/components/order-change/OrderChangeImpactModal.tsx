import React from 'react';
import { Alert, Descriptions, List, Modal, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
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
  confirmText,
}) => {
  const { t } = useTranslation();
  const blocking = impact?.blocking_errors ?? [];
  const canProceed = blocking.length === 0;
  const okText = confirmText ?? t('app.kuaizhizao.orderChange.confirmSubmit');

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
      title={t('app.kuaizhizao.orderChange.impactTitle')}
      open={open}
      onCancel={onClose}
      onOk={canProceed ? onConfirm : undefined}
      okText={okText}
      okButtonProps={{ disabled: !canProceed, loading }}
      width={720}
      destroyOnHidden
    >
      {blocking.length > 0 && (
        <Alert
          type="error"
          showIcon
          title={t('app.kuaizhizao.orderChange.blockingTitle')}
          description={blocking.join('；')}
          style={{ marginBottom: 16 }}
        />
      )}
      {(impact?.recommended_actions?.length ?? 0) > 0 && (
        <Descriptions size="small" column={1} style={{ marginBottom: 16 }}>
          <Descriptions.Item label={t('app.kuaizhizao.orderChange.recommendedActions')}>
            {(impact?.recommended_actions ?? []).join('、')}
          </Descriptions.Item>
        </Descriptions>
      )}
      {renderList(t('app.kuaizhizao.orderChange.affectedDemands'), impact?.affected_demands)}
      {renderList(t('app.kuaizhizao.orderChange.affectedComputations'), impact?.affected_computations)}
      {renderList(t('app.kuaizhizao.orderChange.affectedPlans'), impact?.affected_plans)}
      {renderList(t('app.kuaizhizao.orderChange.affectedWorkOrders'), impact?.affected_work_orders)}
      {renderList(t('app.kuaizhizao.orderChange.affectedReceiptNotices'), impact?.affected_receipt_notices)}
      {renderList(t('app.kuaizhizao.orderChange.affectedInbounds'), impact?.affected_inbounds)}
      {!impact && !loading && <Alert type="info" title={t('app.kuaizhizao.orderChange.noImpactData')} />}
    </Modal>
  );
};
