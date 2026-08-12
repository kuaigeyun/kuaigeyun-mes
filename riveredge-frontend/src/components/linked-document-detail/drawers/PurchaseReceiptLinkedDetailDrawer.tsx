/**
 * 关联单据：采购入库单原版详情（只读插槽壳）
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Descriptions, Spin, Table, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { DetailDrawerTemplate, DRAWER_CONFIG } from '../../layout-templates';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../document-tracking-panel';
import { UniLifecycleStepper } from '../../uni-lifecycle';
import { warehouseApi } from '../../../apps/kuaizhizao/services/production';
import { getInboundLifecycle } from '../../../apps/kuaizhizao/utils/inboundLifecycle';
import { normalizeInboundHubDetail } from '../../../apps/kuaizhizao/pages/warehouse-management/inbound/inboundHubNormalize';
import { formatDateTimeBySiteSetting, formatQuantity } from '../../../utils/format';

export type PurchaseReceiptLinkedDetailDrawerProps = {
  open: boolean;
  documentId: number;
  onClose: () => void;
  zIndex?: number;
};

type ReceiptDetail = Record<string, unknown> & {
  id?: number;
  receipt_code?: string;
  status?: string;
  warehouse_name?: string;
  receipt_date?: string;
  supplier_name?: string;
  purchase_order_code?: string;
  notes?: string;
  items?: Array<Record<string, unknown>>;
};

export function PurchaseReceiptLinkedDetailDrawer({
  open,
  documentId,
  onClose,
  zIndex,
}: PurchaseReceiptLinkedDetailDrawerProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [detail, setDetail] = useState<ReceiptDetail | null>(null);
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
      const raw = (await warehouseApi.purchaseReceipt.get(String(documentId))) as Record<string, unknown>;
      setDetail(normalizeInboundHubDetail('purchase', raw) as ReceiptDetail);
    } catch (e: unknown) {
      const err = e as { message?: string; detail?: string };
      message.error(
        err?.message || err?.detail || t('app.kuaizhizao.warehouseInbound.msg.loadDetailFailed'),
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
    () => (detail ? getInboundLifecycle(detail as Record<string, unknown>) : null),
    [detail],
  );
  const nextSteps = lifecycle?.nextStepSuggestions;
  const tracking = useDocumentTracking(
    open && detail?.id ? 'purchase_receipt' : undefined,
    detail?.id,
    refreshKey,
  );

  const code = String(detail?.receipt_code ?? '');
  const title = `${t('app.kuaizhizao.warehouseInbound.detail.title')}${code ? ` - ${code}` : ''}`;

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

  const dateRaw = detail.receipt_date;
  const dateText = dateRaw
    ? formatDateTimeBySiteSetting(String(dateRaw), 'YYYY-MM-DD') || String(dateRaw)
    : '-';
  const items = Array.isArray(detail.items) ? detail.items : [];

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
            hideNextStepSuggestions
          />
        ) : null
      }
      basic={
        <Descriptions
          column={3}
          size="small"
          items={[
            { key: 'code', label: t('app.kuaizhizao.warehouseInbound.col.docNo'), children: code || '-' },
            {
              key: 'type',
              label: t('app.kuaizhizao.warehouseInbound.col.receiptType'),
              children: t('components.documentTrackingPanel.docType.purchase_receipt'),
            },
            {
              key: 'status',
              label: t('app.kuaizhizao.warehouseInbound.col.status'),
              children: String(detail.status ?? '-'),
            },
            {
              key: 'wh',
              label: t('app.kuaizhizao.warehouseInbound.col.warehouse'),
              children: String(detail.warehouse_name ?? '-'),
            },
            { key: 'date', label: t('app.kuaizhizao.warehouseInbound.col.date'), children: dateText },
            {
              key: 'supplier',
              label: t('app.kuaizhizao.warehouseInbound.col.supplier'),
              children: String(detail.supplier_name ?? '-'),
            },
            {
              key: 'po',
              label: t('app.kuaizhizao.warehouseInbound.col.poCode'),
              children: String(detail.purchase_order_code ?? '-'),
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
      linesTitle={t('app.kuaizhizao.warehouseInbound.section.detailInfo')}
      lines={
        <Table
          size="small"
          rowKey={(r) => String(r.id ?? r.material_id ?? Math.random())}
          pagination={false}
          scroll={{ x: 900 }}
          dataSource={items}
          columns={[
            {
              title: t('app.kuaizhizao.warehouseInbound.col.materialCode'),
              dataIndex: 'material_code',
              width: 120,
            },
            {
              title: t('app.kuaizhizao.warehouseInbound.col.materialName'),
              dataIndex: 'material_name',
              width: 150,
            },
            {
              title: t('app.kuaizhizao.warehouseInbound.col.actualQty'),
              dataIndex: 'receipt_quantity',
              width: 100,
              align: 'right',
              render: (v) => formatQuantity(v),
            },
            {
              title: t('app.kuaizhizao.warehouseInbound.col.unit'),
              dataIndex: 'material_unit',
              width: 60,
              render: (v, row) => String(v ?? row.unit ?? '-'),
            },
            {
              title: t('app.kuaizhizao.warehouseInbound.col.unitPrice'),
              dataIndex: 'unit_price',
              width: 100,
              align: 'right',
            },
            {
              title: t('app.kuaizhizao.warehouseInbound.col.batchNo'),
              dataIndex: 'batch_number',
              width: 100,
              render: (v) => (v != null && String(v).trim() ? String(v) : '—'),
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
          {tracking.data && !tracking.loading ? <DocumentTrackingTimelineBody data={tracking.data} /> : null}
        </>
      }
      traceDocument={{
        documentType: 'purchase_receipt',
        documentId: Number(detail.id),
        selfDocumentId: Number(detail.id),
      }}
    />
  );
}
