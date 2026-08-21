/**
 * 入库单原版详情抽屉（列表 / 关联嵌套共用）。
 * 单一 DetailDrawerTemplate：加载中遮罩，失败 Result+重试。
 */

import React, { useMemo } from 'react';
import { Button, Descriptions, Empty, Result, Table, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import {
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  WAREHOUSE_DETAIL_TABLE_STYLES,
  detailDrawerBasicColumn,
  useDetailDrawerDescriptionItems,
} from '../../../../../../components/layout-templates';
import { UniLifecycleStepper } from '../../../../../../components/uni-lifecycle';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../../components/document-tracking-panel';
import { alignDescriptionColumns } from '../../../sales-management/shared/documentFieldAlignment';
import { formatDateBySiteSetting, formatDateTimeBySiteSetting, formatQuantity } from '../../../../../../utils/format';
import { getInboundLifecycle } from '../../../../utils/inboundLifecycle';
import { renderInboundReceiptTypeMarkerTag } from '../../shared/warehouseMarkerTags';
import {
  inboundDocumentTrackingType,
  resolveInboundHubOperator,
  type InboundHubOrder,
} from '../inboundHubTypes';

export type InboundDetailRecord = InboundHubOrder & {
  workshop_name?: string;
  notes?: string;
  items?: unknown[];
};

const PLACEHOLDER: InboundDetailRecord = { id: 0 };

function formatInboundDateDisplay(record: InboundDetailRecord): string {
  const dateOnly = record.receipt_date ?? record.registration_date;
  if (dateOnly) return formatDateBySiteSetting(String(dateOnly));
  const timeValue =
    record.receipt_time ?? record.return_time ?? record.received_at ?? record.returned_at;
  if (timeValue) return formatDateTimeBySiteSetting(String(timeValue));
  return '-';
}

export type InboundDetailDrawerProps = {
  open: boolean;
  onClose: () => void;
  order: InboundDetailRecord | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  zIndex?: number;
  trackingRefreshKey?: number;
  extra?: React.ReactNode;
  supplementary?: React.ReactNode;
  lines?: React.ReactNode;
  linesTitle?: string;
  timeline?: React.ReactNode;
  traceDocument?: React.ComponentProps<typeof DetailDrawerTemplate>['traceDocument'];
  showReadonlyActions?: boolean;
};

export const InboundDetailDrawer: React.FC<InboundDetailDrawerProps> = ({
  open,
  onClose,
  order,
  loading = false,
  error = null,
  onRetry,
  zIndex,
  trackingRefreshKey = 0,
  extra,
  supplementary,
  lines,
  linesTitle,
  timeline,
  traceDocument,
}) => {
  const { t } = useTranslation();

  const contentReady = Boolean(order);
  const showError = Boolean(error) && !contentReady && !loading;
  const showLoading = loading || (!contentReady && !showError);
  const effective = order ?? PLACEHOLDER;
  const trackingType = inboundDocumentTrackingType(effective);
  const tracking = useDocumentTracking(
    open && contentReady ? trackingType : undefined,
    effective.id,
    trackingRefreshKey,
  );

  const lifecycle = useMemo(
    () => (contentReady ? getInboundLifecycle(effective) : null),
    [contentReady, effective],
  );
  const nextSteps = lifecycle?.nextStepSuggestions;

  const code = String(effective.receipt_code || effective.return_code || '').trim();
  const title = `${
    effective.receipt_type === 'production_return'
      ? t('app.kuaizhizao.warehouseInbound.detail.productionReturnTitle')
      : t('app.kuaizhizao.warehouseInbound.detail.title')
  }${code ? ` - ${code}` : ''}`;

  const basicColumns = useMemo(
    () =>
      alignDescriptionColumns([
        {
          title: t('app.kuaizhizao.warehouseInbound.col.docNo'),
          dataIndex: 'receipt_code',
          render: (_, record) => {
            const display = String(record.receipt_code || record.return_code || '').trim();
            return (
              <Typography.Text copyable={display ? { text: display } : undefined}>
                {display || '-'}
              </Typography.Text>
            );
          },
        },
        {
          title: t('app.kuaizhizao.warehouseInbound.field.type'),
          dataIndex: 'receipt_type',
          render: (_, record) => renderInboundReceiptTypeMarkerTag(t, record.receipt_type),
        },
        ...(effective.customer_name
          ? [
              {
                title: t('app.kuaizhizao.warehouseInbound.col.customer'),
                dataIndex: 'customer_name' as const,
              },
            ]
          : []),
        ...(effective.supplier_name
          ? [
              {
                title: t('app.kuaizhizao.warehouseInbound.field.supplier'),
                dataIndex: 'supplier_name' as const,
              },
            ]
          : []),
        ...(effective.purchase_order_code
          ? [
              {
                title: t('app.kuaizhizao.warehouseInbound.field.purchaseOrderCode'),
                dataIndex: 'purchase_order_code' as const,
              },
            ]
          : []),
        ...(effective.work_order_code
          ? [
              {
                title: t('app.kuaizhizao.warehouseInbound.field.workOrderCode'),
                dataIndex: 'work_order_code' as const,
                key: 'linked_work_order_code',
              },
            ]
          : []),
        ...(effective.picking_code
          ? [
              {
                title: t('app.kuaizhizao.warehouseInbound.field.pickingCode'),
                dataIndex: 'picking_code' as const,
                key: 'linked_picking_code',
              },
            ]
          : []),
        ...(effective.workshop_name
          ? [
              {
                title: t('app.kuaizhizao.warehouseInbound.field.workshop'),
                dataIndex: 'workshop_name' as const,
              },
            ]
          : []),
        {
          title: t('app.kuaizhizao.warehouseInbound.field.warehouse'),
          dataIndex: 'warehouse_name',
        },
        {
          title: t('app.kuaizhizao.warehouseInbound.field.date'),
          dataIndex: 'receipt_date',
          render: (_, record) => formatInboundDateDisplay(record),
        },
        {
          title: t('app.kuaizhizao.warehouseInbound.field.operator'),
          dataIndex: 'operator_name',
          render: (_, record) => resolveInboundHubOperator(record) || '-',
        },
        ...(effective.notes
          ? [
              {
                title: t('common.remark'),
                dataIndex: 'notes' as const,
                span: 3,
              },
            ]
          : []),
      ] as ProDescriptionsItemProps<InboundDetailRecord>[]),
    [effective.customer_name, effective.notes, effective.picking_code, effective.purchase_order_code, effective.supplier_name, effective.work_order_code, effective.workshop_name, t],
  );

  const defaultLinesTitle =
    effective.receipt_type === 'production_return'
      ? t('app.kuaizhizao.warehouseInbound.section.returnDetails')
      : t('app.kuaizhizao.warehouseInbound.section.detailInfo');

  const items = (Array.isArray(effective.items) ? effective.items : []) as Array<Record<string, unknown>>;

  const defaultLines = (
    <>
      <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
      {items.length > 0 ? (
        <Table
          className="warehouse-detail-table"
          size="small"
          rowKey={(r, idx) => String(r.id ?? r.material_id ?? idx)}
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
              render: (v, row) => formatQuantity(v ?? row.return_quantity ?? row.quantity),
            },
            {
              title: t('common.unit'),
              dataIndex: 'material_unit',
              width: 60,
              render: (v, row) => String(v ?? row.unit ?? '-'),
            },
            {
              title: t('app.kuaizhizao.warehouseInbound.col.batchNo'),
              dataIndex: 'batch_number',
              width: 100,
              render: (v) => (v != null && String(v).trim() ? String(v) : '—'),
            },
          ]}
        />
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('app.kuaizhizao.warehouseInbound.detail.noDetails')}
        />
      )}
    </>
  );

  const defaultTimeline =
    contentReady && effective.id != null ? (
      tracking.data && !tracking.loading ? (
        <DocumentTrackingTimelineBody data={tracking.data} />
      ) : tracking.error ? (
        <Typography.Text type="danger">{tracking.error}</Typography.Text>
      ) : null
    ) : null;

  const defaultTrace =
    contentReady && effective.id != null && trackingType
      ? {
          documentType: trackingType,
          documentId: Number(effective.id),
          selfDocumentId: Number(effective.id),
        }
      : undefined;

  const timeconfigBasicItems = useDetailDrawerDescriptionItems(
    basicColumns, effective,
    'inbound',
  );

  if (!open) return null;

  return (
    <DetailDrawerTemplate
      title={title}
      open={open}
      onClose={onClose}
      width={DRAWER_CONFIG.HALF_WIDTH}
      zIndex={zIndex}
      loading={showLoading}
      plainBody={
        showError ? (
          <Result
            status="error"
            title={error}
            extra={
              onRetry ? (
                <Button type="primary" onClick={onRetry}>
                  {t('common.retry', { defaultValue: '重试' })}
                </Button>
              ) : null
            }
          />
        ) : undefined
      }
      extra={contentReady ? extra ?? null : null}
      collaborationTitleSuffix={
        contentReady && nextSteps?.length ? (
          <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
            {t('common.next')}：
            {nextSteps.join(t('components.uniLifecycle.nextStepSeparator'))}
          </Typography.Text>
        ) : undefined
      }
      collaborationAuditRecord={contentReady ? (effective as Record<string, unknown>) : null}
      basic={
        contentReady ? (
          <Descriptions
            column={detailDrawerBasicColumn(false)}
            size="small"
            items={timeconfigBasicItems}
          />
        ) : showError ? null : (
          <div style={{ minHeight: 80 }} />
        )
      }
      collaboration={
        contentReady && lifecycle && (lifecycle.mainStages ?? []).length > 0 ? (
          <UniLifecycleStepper
            steps={lifecycle.mainStages ?? []}
            status={lifecycle.status}
            showLabels
            nextStepSuggestions={lifecycle.nextStepSuggestions}
            hideNextStepSuggestions
          />
        ) : null
      }
      supplementary={contentReady ? supplementary : undefined}
      linesTitle={linesTitle ?? defaultLinesTitle}
      lines={contentReady ? (lines ?? defaultLines) : undefined}
      timeline={contentReady ? (timeline ?? defaultTimeline) : undefined}
      traceDocument={contentReady ? (traceDocument ?? defaultTrace) : undefined}
    />
  );
};
