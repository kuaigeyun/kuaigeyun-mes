/**
 * 关联单据：销售出库单原版详情（只读插槽壳）
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Descriptions, Spin, Table, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { DetailDrawerTemplate, DRAWER_CONFIG } from '../../layout-templates';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../document-tracking-panel';
import { UniLifecycleStepper } from '../../uni-lifecycle';
import { warehouseApi } from '../../../apps/kuaizhizao/services/production';
import { getOutboundLifecycle } from '../../../apps/kuaizhizao/utils/outboundLifecycle';
import { formatDateTime, formatDateTimeBySiteSetting } from '../../../utils/format';

export type SalesDeliveryLinkedDetailDrawerProps = {
  open: boolean;
  documentId: number;
  onClose: () => void;
  zIndex?: number;
};

type SalesDeliveryDetail = Record<string, unknown> & {
  id?: number;
  delivery_code?: string;
  status?: string;
  warehouse_name?: string;
  delivery_date?: string;
  customer_name?: string;
  sales_order_code?: string;
  notes?: string;
  total_quantity?: number;
  items?: Array<Record<string, unknown>>;
};

export function SalesDeliveryLinkedDetailDrawer({
  open,
  documentId,
  onClose,
  zIndex,
}: SalesDeliveryLinkedDetailDrawerProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [detail, setDetail] = useState<SalesDeliveryDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshKey] = useState(0);

  const load = useCallback(async () => {
    if (!open || documentId <= 0) {
      setDetail(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const raw = (await warehouseApi.salesDelivery.get(String(documentId))) as SalesDeliveryDetail;
      setDetail({ ...raw, outbound_type: 'sales_delivery' });
    } catch (e: unknown) {
      const err = e as { message?: string; detail?: string };
      message.error(
        err?.message || err?.detail || t('app.kuaizhizao.warehouseOutbound.msg.loadDetailFailed'),
      );
      onClose();
    } finally {
      setLoading(false);
    }
  }, [open, documentId, message, onClose, t]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const lifecycle = useMemo(
    () => (detail ? getOutboundLifecycle(detail as any, t) : null),
    [detail, t],
  );
  const nextSteps = lifecycle?.nextStepSuggestions;
  const tracking = useDocumentTracking(
    open && detail?.id ? 'sales_delivery' : undefined,
    detail?.id,
    refreshKey,
  );

  const code = String(detail?.delivery_code ?? '');
  const title = `${t('app.kuaizhizao.warehouseOutbound.detail.title')}${code ? ` - ${code}` : ''}`;

  if (!open) return null;

  if (loading || !detail) {
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

  const dateRaw = detail.delivery_date;
  const dateText = dateRaw
    ? formatDateTimeBySiteSetting(String(dateRaw), 'YYYY-MM-DD') || formatDateTime(String(dateRaw), 'YYYY-MM-DD')
    : '-';

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
      collaborationAuditRecord={detail as any}
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
            {
              key: 'code',
              label: t('app.kuaizhizao.warehouseOutbound.field.outboundCode'),
              children: code || '-',
            },
            {
              key: 'type',
              label: t('app.kuaizhizao.warehouseOutbound.field.outboundType'),
              children: t('components.documentTrackingPanel.docType.sales_delivery'),
            },
            {
              key: 'status',
              label: t('app.kuaizhizao.warehouseOutbound.col.status'),
              children: String(detail.status ?? '-'),
            },
            {
              key: 'wh',
              label: t('app.kuaizhizao.warehouseOutbound.field.warehouse'),
              children: String(detail.warehouse_name ?? '-'),
            },
            {
              key: 'date',
              label: t('app.kuaizhizao.warehouseOutbound.col.outboundDate'),
              children: dateText,
            },
            {
              key: 'customer',
              label: t('app.kuaizhizao.warehouseOutbound.col.customer'),
              children: String(detail.customer_name ?? '-'),
            },
            {
              key: 'so',
              label: t('app.kuaizhizao.deliveryNote.col.salesOrderCode'),
              children: String(detail.sales_order_code ?? '-'),
            },
            {
              key: 'notes',
              label: t('app.kuaizhizao.common.fieldNotes'),
              children: String(detail.notes ?? '-'),
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
          scroll={{ x: 800 }}
          dataSource={(detail.items as Array<Record<string, unknown>>) ?? []}
          columns={[
            {
              title: t('app.kuaizhizao.warehouseOutbound.col.materialCode'),
              dataIndex: 'material_code',
              width: 120,
            },
            {
              title: t('app.kuaizhizao.warehouseOutbound.col.materialName'),
              dataIndex: 'material_name',
              width: 150,
            },
            {
              title: t('app.kuaizhizao.warehouseOutbound.col.deliveryQty'),
              dataIndex: 'delivery_quantity',
              width: 100,
              align: 'right',
            },
            {
              title: t('app.kuaizhizao.warehouseOutbound.col.unit'),
              dataIndex: 'material_unit',
              width: 60,
            },
            {
              title: t('app.kuaizhizao.warehouseOutbound.col.batchNo'),
              dataIndex: 'batch_number',
              width: 100,
            },
            { title: t('app.kuaizhizao.common.fieldNotes'), dataIndex: 'notes' },
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
          {tracking.data && !tracking.loading ? <DocumentTrackingTimelineBody data={tracking.data} /> : null}
        </>
      }
      traceDocument={{
        documentType: 'sales_delivery',
        documentId: Number(detail.id),
        selfDocumentId: Number(detail.id),
      }}
    />
  );
}
