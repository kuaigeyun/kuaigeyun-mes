/**
 * 出库单原版详情抽屉（列表 / 关联嵌套共用）。
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
  detailDrawerDescriptionItems,
} from '../../../../../../components/layout-templates';
import { UniLifecycleStepper } from '../../../../../../components/uni-lifecycle';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../../components/document-tracking-panel';
import { alignDescriptionColumns } from '../../../sales-management/shared/documentFieldAlignment';
import { formatDateTimeBySiteSetting } from '../../../../../../utils/format';
import { getOutboundLifecycle } from '../../../../utils/outboundLifecycle';
import { renderOutboundIssueTypeMarkerTag } from '../../shared/warehouseMarkerTags';
import {
  outboundDocumentTrackingType,
  resolveOutboundHubDateRaw,
  resolveOutboundHubOperator,
  type OutboundHubOrder,
} from '../outboundHubTypes';

export type OutboundDetailRecord = OutboundHubOrder & {
  items?: unknown[];
};

const PLACEHOLDER: OutboundDetailRecord = { id: 0 };

export type OutboundDetailDrawerProps = {
  open: boolean;
  onClose: () => void;
  order: OutboundDetailRecord | null;
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
  notesEditor?: React.ReactNode;
  traceDocument?: React.ComponentProps<typeof DetailDrawerTemplate>['traceDocument'];
  showReadonlyActions?: boolean;
};

export const OutboundDetailDrawer: React.FC<OutboundDetailDrawerProps> = ({
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
  notesEditor,
  traceDocument,
}) => {
  const { t } = useTranslation();

  const contentReady = Boolean(order);
  const showError = Boolean(error) && !contentReady && !loading;
  const showLoading = loading || (!contentReady && !showError);
  const effective = order ?? PLACEHOLDER;
  const trackingType = outboundDocumentTrackingType(effective);
  const tracking = useDocumentTracking(
    open && contentReady ? trackingType : undefined,
    effective.id,
    trackingRefreshKey,
  );

  const lifecycle = useMemo(
    () => (contentReady ? getOutboundLifecycle(effective as Record<string, unknown>, t) : null),
    [contentReady, effective, t],
  );
  const nextSteps = lifecycle?.nextStepSuggestions;

  const code = String(effective.delivery_code || effective.picking_code || '').trim();
  const title = `${t('app.kuaizhizao.warehouseOutbound.detail.title')}${code ? ` - ${code}` : ''}`;

  const showNotes = Boolean(notesEditor || effective.notes);

  const basicColumns = useMemo(
    () =>
      alignDescriptionColumns([
        {
          title: t('app.kuaizhizao.warehouseOutbound.field.outboundCode'),
          dataIndex: 'delivery_code',
          render: (_, record) => {
            const display = String(record.delivery_code || record.picking_code || '').trim();
            return (
              <Typography.Text copyable={display ? { text: display } : undefined}>
                {display || '-'}
              </Typography.Text>
            );
          },
        },
        {
          title: t('app.kuaizhizao.warehouseOutbound.field.outboundType'),
          dataIndex: 'outbound_type',
          render: (_, record) => renderOutboundIssueTypeMarkerTag(t, record.outbound_type),
        },
        ...(effective.customer_name
          ? [
              {
                title: t('app.kuaizhizao.warehouseOutbound.col.customer'),
                dataIndex: 'customer_name' as const,
              },
            ]
          : []),
        ...(effective.work_order_code
          ? [
              {
                title: t('app.kuaizhizao.warehouseOutbound.col.workOrderCode'),
                dataIndex: 'work_order_code' as const,
                key: 'linked_work_order_code',
              },
            ]
          : []),
        {
          title: t('app.kuaizhizao.warehouseOutbound.field.warehouse'),
          dataIndex: 'warehouse_name',
        },
        {
          title: t('app.kuaizhizao.warehouseOutbound.col.outboundDate'),
          dataIndex: 'delivery_date',
          render: (_, record) => {
            const raw = resolveOutboundHubDateRaw(record);
            return raw ? formatDateTimeBySiteSetting(String(raw)) : '-';
          },
        },
        {
          title: t('app.kuaizhizao.warehouseOutbound.col.operator'),
          dataIndex: 'operator_name',
          render: (_, record) => resolveOutboundHubOperator(record) || '-',
        },
        {
          title: t('app.kuaizhizao.warehouseOutbound.col.totalQty'),
          dataIndex: 'total_quantity',
        },
        {
          title: t('app.kuaizhizao.warehouseOutbound.col.totalSku'),
          dataIndex: 'total_items',
        },
        ...(showNotes
          ? [
              {
                title: t('app.kuaizhizao.common.fieldNotes'),
                dataIndex: 'notes' as const,
                span: 3,
                render: (_: unknown, record: OutboundDetailRecord) =>
                  notesEditor ?? (
                    <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                      {record.notes}
                    </Typography.Paragraph>
                  ),
              },
            ]
          : []),
      ] as ProDescriptionsItemProps<OutboundDetailRecord>[]),
    [effective.customer_name, effective.work_order_code, notesEditor, showNotes, t],
  );

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
          scroll={{ x: 800 }}
          dataSource={items}
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
              render: (v, row) => v ?? row.picked_quantity ?? row.quantity ?? '-',
            },
            {
              title: t('app.kuaizhizao.warehouseOutbound.col.unit'),
              dataIndex: 'material_unit',
              width: 60,
              render: (v, row) => String(v ?? row.unit ?? '-'),
            },
            {
              title: t('app.kuaizhizao.warehouseOutbound.col.batchNo'),
              dataIndex: 'batch_number',
              width: 100,
            },
            { title: t('app.kuaizhizao.common.fieldNotes'), dataIndex: 'notes' },
          ]}
        />
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('app.kuaizhizao.warehouseOutbound.detail.noOperationLog')}
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
            {t('components.uniLifecycle.nextStep')}：
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
            items={detailDrawerDescriptionItems(basicColumns, effective)}
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
          />
        ) : null
      }
      supplementary={contentReady ? supplementary : undefined}
      linesTitle={linesTitle ?? t('app.kuaizhizao.warehouseOutbound.section.outboundDetails')}
      lines={contentReady ? (lines ?? defaultLines) : undefined}
      timeline={contentReady ? (timeline ?? defaultTimeline) : undefined}
      traceDocument={contentReady ? (traceDocument ?? defaultTrace) : undefined}
    />
  );
};
