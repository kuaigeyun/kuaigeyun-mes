import React from 'react';
import { Alert, Button, Descriptions, Modal, Space, Table, Tag, Typography } from 'antd';
import type { TFunction } from 'i18next';
import type { NavigateFunction } from 'react-router-dom';
import { ROUTES } from '../../../constants/routes';
import type {
  EnsureFqcForFinishedGoodsReceiptLineSummary,
  EnsureFqcForFinishedGoodsReceiptResult,
} from '../../../services/quality-execution';

type Props = {
  open: boolean;
  loading?: boolean;
  finishedGoodsReceiptId?: number | string;
  ensure: EnsureFqcForFinishedGoodsReceiptResult | null;
  t: TFunction;
  navigate: NavigateFunction;
  onCancel: () => void;
  onContinue: () => void;
};

function renderInboundTag(t: TFunction, canInbound: boolean, fqcRequired: boolean) {
  if (!fqcRequired) {
    return <Tag>{t('app.kuaizhizao.warehouseInbound.fqcReview.notRequired')}</Tag>;
  }
  return canInbound ? (
    <Tag color="success">{t('app.kuaizhizao.warehouseInbound.fqcReview.canInbound')}</Tag>
  ) : (
    <Tag color="warning">{t('app.kuaizhizao.warehouseInbound.fqcReview.pendingInbound')}</Tag>
  );
}

export const FinishedGoodsReceiptFqcReviewModal: React.FC<Props> = ({
  open,
  loading,
  finishedGoodsReceiptId,
  ensure,
  t,
  navigate,
  onCancel,
  onContinue,
}) => {
  const lines = ensure?.line_summaries ?? [];
  const canConfirm = ensure?.can_confirm_inbound === true;
  const workOrderId = ensure?.work_order_id;

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
      title: t('app.kuaizhizao.warehouseInbound.fqcReview.colRequired'),
      dataIndex: 'fqc_required',
      width: 92,
      render: (v: boolean) =>
        v ? t('app.kuaizhizao.warehouseInbound.fqcReview.requiredYes') : t('app.kuaizhizao.warehouseInbound.fqcReview.requiredNo'),
    },
    {
      title: t('app.kuaizhizao.warehouseInbound.fqcReview.colPlan'),
      dataIndex: 'plan_label',
      width: 140,
      ellipsis: true,
      render: (_: unknown, row: EnsureFqcForFinishedGoodsReceiptLineSummary) =>
        row.fqc_required ? row.plan_label || '—' : '—',
    },
    {
      title: t('app.kuaizhizao.warehouseInbound.fqcReview.colInspection'),
      dataIndex: 'inspection_code',
      width: 130,
      ellipsis: true,
      render: (_: unknown, row: EnsureFqcForFinishedGoodsReceiptLineSummary) => row.inspection_code || '—',
    },
    {
      title: t('app.kuaizhizao.warehouseInbound.fqcReview.colStatus'),
      key: 'status',
      width: 120,
      render: (_: unknown, row: EnsureFqcForFinishedGoodsReceiptLineSummary) => {
        if (!row.fqc_required) return '—';
        if (!row.inspection_status) return t('app.kuaizhizao.warehouseInbound.fqcReview.statusNotCreated');
        return [row.inspection_status, row.quality_status].filter(Boolean).join(' / ');
      },
    },
    {
      title: t('app.kuaizhizao.warehouseInbound.fqcReview.colCanInbound'),
      key: 'can_inbound',
      width: 96,
      align: 'center' as const,
      render: (_: unknown, row: EnsureFqcForFinishedGoodsReceiptLineSummary) =>
        renderInboundTag(t, row.can_inbound, row.fqc_required),
    },
  ];

  return (
    <Modal
      open={open}
      title={t('app.kuaizhizao.warehouseInbound.fqcReview.title')}
      width={960}
      destroyOnHidden
      confirmLoading={loading}
      onCancel={onCancel}
      footer={
        <Space>
          <Button onClick={onCancel}>{t('common.cancel')}</Button>
          {finishedGoodsReceiptId != null && ensure?.requires_fqc && !canConfirm && workOrderId != null ? (
            <Button
              type="primary"
              onClick={() => {
                onCancel();
                navigate(`${ROUTES.FINISHED_GOODS_INSPECTION}?work_order_id=${workOrderId}`);
              }}
            >
              {t('app.kuaizhizao.warehouseInbound.fqc.ensureBlocked.goInspect')}
            </Button>
          ) : null}
          <Button type="primary" disabled={!canConfirm} onClick={onContinue}>
            {t('app.kuaizhizao.warehouseInbound.fqcReview.continueConfirm')}
          </Button>
        </Space>
      }
    >
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        {ensure?.created_count ? (
          <Alert
            type="info"
            showIcon
            message={t('app.kuaizhizao.warehouseInbound.fqc.autoCreated', { count: ensure.created_count })}
          />
        ) : null}
        {!canConfirm && ensure?.message ? (
          <Alert type="warning" showIcon message={ensure.message} />
        ) : null}
        <Descriptions size="small" column={2} bordered>
          <Descriptions.Item label={t('app.kuaizhizao.warehouseInbound.fqcReview.fqcStage')}>
            {ensure?.fqc_stage_enabled && ensure?.fqc_module_enabled
              ? t('app.kuaizhizao.warehouseInbound.fqcReview.enabled')
              : t('app.kuaizhizao.warehouseInbound.fqcReview.disabled')}
          </Descriptions.Item>
          <Descriptions.Item label={t('app.kuaizhizao.warehouseInbound.fqcReview.gate')}>
            {ensure?.gate_enabled
              ? t('app.kuaizhizao.warehouseInbound.fqcReview.gateOn')
              : t('app.kuaizhizao.warehouseInbound.fqcReview.gateOff')}
          </Descriptions.Item>
          {ensure?.work_order_code ? (
            <Descriptions.Item label={t('app.kuaizhizao.warehouseInbound.fqcReview.workOrder')} span={2}>
              {ensure.work_order_code}
            </Descriptions.Item>
          ) : null}
        </Descriptions>
        <Typography.Text type="secondary">{t('app.kuaizhizao.warehouseInbound.fqcReview.hint')}</Typography.Text>
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
