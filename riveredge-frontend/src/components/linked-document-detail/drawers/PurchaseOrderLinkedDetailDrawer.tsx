/**
 * 关联单据：采购订单原版详情（只读插槽壳）
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Descriptions, Spin, Table, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { DetailDrawerTemplate, DRAWER_CONFIG } from '../../layout-templates';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../document-tracking-panel';
import { UniLifecycleStepper } from '../../uni-lifecycle';
import { QuantityWithUnitDisplay } from '../../quantity-with-unit';
import { getPurchaseOrder, type PurchaseOrder } from '../../../apps/kuaizhizao/services/purchase';
import { getStatusLabel } from '../../../apps/kuaizhizao/constants/documentStatus';
import { getPurchaseOrderLifecycle } from '../../../apps/kuaizhizao/utils/purchaseOrderLifecycle';
import { useAuditRequired } from '../../../hooks/useAuditRequired';
import { formatDateTime } from '../../../utils/format';

export type PurchaseOrderLinkedDetailDrawerProps = {
  open: boolean;
  documentId: number;
  onClose: () => void;
  zIndex?: number;
};

function formatAmount(val: unknown): string {
  const num = typeof val === 'number' ? val : parseFloat(String(val ?? 0));
  return (Number.isFinite(num) ? num : 0).toLocaleString();
}

export function PurchaseOrderLinkedDetailDrawer({
  open,
  documentId,
  onClose,
  zIndex,
}: PurchaseOrderLinkedDetailDrawerProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const auditRequired = useAuditRequired('purchase_order', false);
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshKey] = useState(0);

  const load = useCallback(async () => {
    if (!open || documentId <= 0) {
      setOrder(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setOrder(await getPurchaseOrder(documentId));
    } catch (e: unknown) {
      const err = e as { message?: string; detail?: string };
      message.error(err?.message || err?.detail || t('app.kuaizhizao.purchaseOrder.detailFailed'));
      onClose();
    } finally {
      setLoading(false);
    }
  }, [open, documentId, message, onClose, t]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const lifecycle = useMemo(
    () => (order ? getPurchaseOrderLifecycle(order, auditRequired, t) : null),
    [order, auditRequired, t],
  );
  const nextSteps = lifecycle?.nextStepSuggestions;
  const tracking = useDocumentTracking(
    open && order?.id ? 'purchase_order' : undefined,
    order?.id,
    refreshKey,
  );

  const title = t('app.kuaizhizao.purchaseOrder.detailTitle', {
    code: order?.order_code || '',
  });

  if (!open) return null;

  if (loading || !order) {
    return (
      <DetailDrawerTemplate
        title={title}
        open={open}
        onClose={onClose}
        width={DRAWER_CONFIG.HALF_WIDTH}
        zIndex={zIndex}
        plainBody={
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin />
          </div>
        }
      />
    );
  }

  return (
    <DetailDrawerTemplate
      title={title}
      open={open}
      onClose={onClose}
      width={DRAWER_CONFIG.HALF_WIDTH}
      zIndex={zIndex}
      collaborationTitleSuffix={
        nextSteps?.length ? (
          <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
            {t('components.uniLifecycle.nextStep')}：
            {nextSteps.join(t('components.uniLifecycle.nextStepSeparator'))}
          </Typography.Text>
        ) : null
      }
      collaborationAuditRecord={order as any}
      collaboration={
        lifecycle && (lifecycle.mainStages ?? []).length > 0 ? (
          <UniLifecycleStepper
            steps={lifecycle.mainStages ?? []}
            status={lifecycle.status}
            showLabels
            nextStepSuggestions={lifecycle.nextStepSuggestions}
            hideNextStepSuggestions={Boolean(nextSteps?.length)}
          />
        ) : null
      }
      basic={
        <Descriptions
          column={3}
          size="small"
          items={[
            { key: 'order_code', label: t('app.kuaizhizao.purchaseOrder.col.orderCode'), children: order.order_code || '-' },
            { key: 'supplier_name', label: t('app.kuaizhizao.purchaseOrder.col.supplier'), children: order.supplier_name || '-' },
            { key: 'order_type', label: t('app.kuaizhizao.purchaseOrder.col.orderType'), children: order.order_type || '-' },
            {
              key: 'order_date',
              label: t('app.kuaizhizao.purchaseOrder.col.orderDate'),
              children: order.order_date ? formatDateTime(order.order_date, 'YYYY-MM-DD') : '-',
            },
            {
              key: 'delivery_date',
              label: t('app.kuaizhizao.purchaseOrder.col.deliveryDate'),
              children: order.delivery_date ? formatDateTime(order.delivery_date, 'YYYY-MM-DD') : '-',
            },
            { key: 'status', label: t('common.status'), children: getStatusLabel(order.status) },
            {
              key: 'total_amount',
              label: t('app.kuaizhizao.purchaseOrder.col.orderAmount'),
              children: `¥${formatAmount(order.total_amount)}`,
            },
            {
              key: 'tax_rate',
              label: t('app.kuaizhizao.purchaseOrder.col.taxRate'),
              children: order.tax_rate != null ? `${order.tax_rate}%` : '-',
            },
            {
              key: 'notes',
              label: t('common.remark'),
              children: order.notes || '-',
              span: 3,
            },
          ]}
        />
      }
      lines={
        <Table
          size="small"
          rowKey={(r) => String(r.id ?? r.material_id ?? Math.random())}
          pagination={false}
          scroll={{ x: 1200 }}
          dataSource={order.items ?? []}
          columns={[
            { title: t('app.kuaizhizao.purchaseOrder.col.materialCode'), dataIndex: 'material_code', width: 120 },
            { title: t('app.kuaizhizao.purchaseOrder.col.materialName'), dataIndex: 'material_name', width: 140 },
            {
              title: t('app.kuaizhizao.purchaseOrder.col.orderedQty'),
              dataIndex: 'ordered_quantity',
              width: 120,
              align: 'right',
              render: (v, row) => <QuantityWithUnitDisplay quantity={v} unit={row.unit} />,
            },
            {
              title: t('app.kuaizhizao.purchaseOrder.col.unitPrice'),
              dataIndex: 'unit_price',
              width: 100,
              align: 'right',
              render: (v) => `¥${formatAmount(v)}`,
            },
            {
              title: t('app.kuaizhizao.purchaseOrder.col.totalPrice'),
              dataIndex: 'total_price',
              width: 110,
              align: 'right',
              render: (v) => `¥${formatAmount(v)}`,
            },
            {
              title: t('app.kuaizhizao.purchaseOrder.col.receivedQty'),
              dataIndex: 'received_quantity',
              width: 120,
              align: 'right',
              render: (v, row) => <QuantityWithUnitDisplay quantity={v} unit={row.unit} />,
            },
            {
              title: t('app.kuaizhizao.purchaseOrder.col.requiredDelivery'),
              dataIndex: 'required_date',
              width: 120,
              render: (v) => (v ? formatDateTime(v, 'YYYY-MM-DD') : '-'),
            },
          ]}
        />
      }
      timeline={
        <>
          {tracking.loading ? (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <Spin />
            </div>
          ) : null}
          {tracking.error && !tracking.loading ? (
            <Typography.Text type="danger">{t('components.documentTrackingPanel.noOperations')}</Typography.Text>
          ) : null}
          {tracking.data && !tracking.loading ? <DocumentTrackingTimelineBody data={tracking.data} /> : null}
        </>
      }
      traceDocument={{
        documentType: 'purchase_order',
        documentId: order.id!,
        selfDocumentId: order.id!,
      }}
    />
  );
}
