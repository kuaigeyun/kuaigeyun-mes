import React from 'react';
import { Alert, Button, Descriptions, Modal, Space, Table, Tag, Typography } from 'antd';
import type { TFunction } from 'i18next';
import type { NavigateFunction } from 'react-router-dom';
import { ROUTES } from '../../../constants/routes';
import type {
  EnsureIqcForPurchaseReceiptLineSummary,
  EnsureIqcForCustomerMaterialRegistrationResult,
} from '../../../services/quality-execution';

type Props = {
  open: boolean;
  loading?: boolean;
  registrationId?: number | string;
  ensure: EnsureIqcForCustomerMaterialRegistrationResult | null;
  t: TFunction;
  navigate: NavigateFunction;
  onCancel: () => void;
  onContinue: () => void;
};

function renderInboundTag(t: TFunction, canInbound: boolean, iqcRequired: boolean) {
  if (!iqcRequired) {
    return <Tag>{t('app.kuaizhizao.warehouseInbound.iqcReview.notRequired')}</Tag>;
  }
  return canInbound ? (
    <Tag color="success">{t('app.kuaizhizao.warehouseInbound.iqcReview.canInbound')}</Tag>
  ) : (
    <Tag color="warning">{t('app.kuaizhizao.warehouseInbound.iqcReview.pendingInbound')}</Tag>
  );
}

export const CustomerMaterialIqcReviewModal: React.FC<Props> = ({
  open,
  loading,
  registrationId,
  ensure,
  t,
  navigate,
  onCancel,
  onContinue,
}) => {
  const lines = ensure?.line_summaries ?? [];
  const canConfirm = ensure?.can_confirm_inbound === true;

  const columns = [
    {
      title: t('app.kuaizhizao.warehouseInbound.col.materialCode'),
      dataIndex: 'material_code',
      width: 110,
      ellipsis: true,
    },
    {
      title: t('app.kuaizhizao.warehouseInbound.col.materialName'),
      dataIndex: 'material_name',
      width: 140,
      ellipsis: true,
    },
    {
      title: t('app.kuaizhizao.warehouseInbound.col.actualQty'),
      dataIndex: 'receipt_quantity',
      width: 88,
      align: 'right' as const,
    },
    {
      title: t('app.kuaizhizao.warehouseInbound.iqcReview.colRequired'),
      dataIndex: 'iqc_required',
      width: 92,
      render: (v: boolean) =>
        v ? t('app.kuaizhizao.warehouseInbound.iqcReview.requiredYes') : t('app.kuaizhizao.warehouseInbound.iqcReview.requiredNo'),
    },
    {
      title: t('app.kuaizhizao.warehouseInbound.iqcReview.colPlan'),
      dataIndex: 'plan_label',
      width: 140,
      ellipsis: true,
      render: (_: unknown, row: EnsureIqcForPurchaseReceiptLineSummary) =>
        row.iqc_required ? row.plan_label || '—' : '—',
    },
    {
      title: t('app.kuaizhizao.warehouseInbound.iqcReview.colInspection'),
      dataIndex: 'inspection_code',
      width: 130,
      ellipsis: true,
      render: (_: unknown, row: EnsureIqcForPurchaseReceiptLineSummary) => row.inspection_code || '—',
    },
    {
      title: t('app.kuaizhizao.warehouseInbound.iqcReview.colStatus'),
      key: 'status',
      width: 120,
      render: (_: unknown, row: EnsureIqcForPurchaseReceiptLineSummary) => {
        if (!row.iqc_required) return '—';
        if (!row.inspection_status) return t('app.kuaizhizao.warehouseInbound.iqcReview.statusNotCreated');
        return [row.inspection_status, row.quality_status].filter(Boolean).join(' / ');
      },
    },
    {
      title: t('app.kuaizhizao.warehouseInbound.iqcReview.colCanInbound'),
      key: 'can_inbound',
      width: 96,
      align: 'center' as const,
      render: (_: unknown, row: EnsureIqcForPurchaseReceiptLineSummary) =>
        renderInboundTag(t, row.can_inbound, row.iqc_required),
    },
  ];

  return (
    <Modal
      open={open}
      title={t('app.kuaizhizao.warehouseInbound.cmIqcReview.title')}
      width={960}
      destroyOnHidden
      confirmLoading={loading}
      onCancel={onCancel}
      footer={
        <Space>
          <Button onClick={onCancel}>{t('common.cancel')}</Button>
          {registrationId != null && ensure?.requires_iqc && !canConfirm ? (
            <Button
              type="primary"
              onClick={() => {
                onCancel();
                navigate(
                  `${ROUTES.INCOMING_INSPECTION}?customer_material_registration_id=${registrationId}`,
                );
              }}
            >
              {t('app.kuaizhizao.warehouseInbound.iqc.ensureBlocked.goInspect')}
            </Button>
          ) : null}
          <Button type="primary" disabled={!canConfirm} onClick={onContinue}>
            {t('app.kuaizhizao.warehouseInbound.cmIqcReview.continueConfirm')}
          </Button>
        </Space>
      }
    >
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        {ensure?.created_count ? (
          <Alert
            type="info"
            showIcon
            message={t('app.kuaizhizao.warehouseInbound.iqc.autoCreated', { count: ensure.created_count })}
          />
        ) : null}
        {!canConfirm && ensure?.message ? (
          <Alert type="warning" showIcon message={ensure.message} />
        ) : null}
        <Descriptions size="small" column={2} bordered>
          {ensure?.registration_code ? (
            <Descriptions.Item label={t('app.kuaizhizao.warehouseInbound.cmIqcReview.registrationCode')} span={2}>
              {ensure.registration_code}
            </Descriptions.Item>
          ) : null}
          <Descriptions.Item label={t('app.kuaizhizao.warehouseInbound.iqcReview.iqcStage')}>
            {ensure?.iqc_stage_enabled && ensure?.iqc_module_enabled
              ? t('app.kuaizhizao.warehouseInbound.iqcReview.enabled')
              : t('app.kuaizhizao.warehouseInbound.iqcReview.disabled')}
          </Descriptions.Item>
          <Descriptions.Item label={t('app.kuaizhizao.warehouseInbound.cmIqcReview.gate')}>
            {ensure?.gate_enabled
              ? t('app.kuaizhizao.warehouseInbound.iqcReview.gateOn')
              : t('app.kuaizhizao.warehouseInbound.iqcReview.gateOff')}
          </Descriptions.Item>
        </Descriptions>
        <Typography.Text type="secondary">{t('app.kuaizhizao.warehouseInbound.cmIqcReview.hint')}</Typography.Text>
        <Table
          size="small"
          rowKey="receipt_item_id"
          pagination={false}
          scroll={{ x: 900, y: 320 }}
          columns={columns}
          dataSource={lines}
        />
      </Space>
    </Modal>
  );
};
