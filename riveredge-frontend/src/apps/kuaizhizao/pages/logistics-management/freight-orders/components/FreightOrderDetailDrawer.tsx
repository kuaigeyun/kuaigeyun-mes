/**
 * 货运单原版详情抽屉（列表 / 关联嵌套共用）。
 * 单一 DetailDrawerTemplate：加载中遮罩，失败 Result+重试。
 */

import React, { useMemo } from 'react';
import { Button, Descriptions, Empty, Result, Table, Timeline, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import {
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  detailDrawerBasicColumn,
  detailDrawerDescriptionItems,
} from '../../../../../../components/layout-templates';
import { SourceDocumentCode } from '../../../../../../components/linked-document-code/SourceDocumentCode';
import { alignDescriptionColumns } from '../../../sales-management/shared/documentFieldAlignment';
import { formatDateTimeBySiteSetting } from '../../../../../../utils/format';
import type { FreightOrder, FreightOrderSource, FreightTrackingEvent } from '../../../../services/logistics';
import {
  logisticsReceiptResultLabel,
  logisticsTrackingEventLabel,
  logisticsTransportModeLabel,
  renderFreightOrderStatusTag,
  renderLogisticsBusinessDirectionTag,
} from '../../shared/logisticsListPresentation';

const PLACEHOLDER: FreightOrder = {
  id: 0,
  uuid: '',
  order_code: '',
  business_direction: '',
  transport_mode: '',
  status: '',
};

export type FreightOrderDetailDrawerProps = {
  open: boolean;
  onClose: () => void;
  order: FreightOrder | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  zIndex?: number;
  extra?: React.ReactNode;
};

export const FreightOrderDetailDrawer: React.FC<FreightOrderDetailDrawerProps> = ({
  open,
  onClose,
  order,
  loading = false,
  error = null,
  onRetry,
  zIndex,
  extra,
}) => {
  const { t } = useTranslation();

  const contentReady = Boolean(order);
  const showError = Boolean(error) && !contentReady && !loading;
  const showLoading = loading || (!contentReady && !showError);
  const effective = order ?? PLACEHOLDER;
  const receipt = effective.receipt;

  const basicColumns = useMemo(
    () =>
      alignDescriptionColumns([
        { title: t('app.kuaizhizao.logistics.field.orderCode'), dataIndex: 'order_code' },
        {
          title: t('app.kuaizhizao.logistics.field.businessDirection'),
          dataIndex: 'business_direction',
          render: (_, record) => renderLogisticsBusinessDirectionTag(t, record.business_direction),
        },
        {
          title: t('app.kuaizhizao.logistics.field.transportMode'),
          dataIndex: 'transport_mode',
          render: (_, record) => logisticsTransportModeLabel(t, record.transport_mode),
        },
        { title: t('app.kuaizhizao.logistics.field.carrierName'), dataIndex: 'carrier_name' },
        { title: t('app.kuaizhizao.logistics.field.plateNumber'), dataIndex: 'vehicle_plate' },
        { title: t('app.kuaizhizao.logistics.field.driverName'), dataIndex: 'driver_name' },
        { title: t('app.kuaizhizao.logistics.field.phone'), dataIndex: 'driver_phone' },
        { title: t('app.kuaizhizao.logistics.field.trackingNumber'), dataIndex: 'tracking_number' },
        {
          title: t('app.kuaizhizao.logistics.field.plannedDepartAt'),
          dataIndex: 'planned_depart_at',
          valueType: 'dateTime',
        },
        {
          title: t('app.kuaizhizao.logistics.field.plannedArriveAt'),
          dataIndex: 'planned_arrive_at',
          valueType: 'dateTime',
        },
        {
          title: t('app.kuaizhizao.logistics.field.actualDepartAt'),
          dataIndex: 'actual_depart_at',
          valueType: 'dateTime',
        },
        {
          title: t('app.kuaizhizao.logistics.field.actualArriveAt'),
          dataIndex: 'actual_arrive_at',
          valueType: 'dateTime',
        },
        {
          title: t('app.kuaizhizao.logistics.field.originAddress'),
          dataIndex: 'origin_address',
          span: 3,
        },
        { title: t('app.kuaizhizao.logistics.field.senderPhone'), dataIndex: 'sender_phone' },
        {
          title: t('app.kuaizhizao.logistics.field.destinationAddress'),
          dataIndex: 'destination_address',
          span: 3,
        },
        { title: t('app.kuaizhizao.logistics.field.recipientPhone'), dataIndex: 'recipient_phone' },
        ...(receipt?.signed_by
          ? [
              {
                title: t('app.kuaizhizao.logistics.field.signedBy'),
                dataIndex: 'signed_by' as const,
                render: () => receipt.signed_by || '-',
              },
            ]
          : []),
        ...(receipt?.receipt_result
          ? [
              {
                title: t('app.kuaizhizao.logistics.field.receiptResult'),
                dataIndex: 'receipt_result' as const,
                render: () => logisticsReceiptResultLabel(t, receipt.receipt_result),
              },
            ]
          : []),
        {
          title: t('app.kuaizhizao.logistics.field.status'),
          dataIndex: 'status',
          render: (_, record) => renderFreightOrderStatusTag(t, record.status),
        },
        {
          title: t('common.remark'),
          dataIndex: 'remark',
          span: 3,
        },
      ] as ProDescriptionsItemProps<FreightOrder>[]),
    [receipt?.receipt_result, receipt?.signed_by, t],
  );

  const sources = (effective.sources ?? []) as FreightOrderSource[];
  const events = (effective.tracking_events ?? []) as FreightTrackingEvent[];
  const code = String(effective.order_code ?? '').trim();
  const title = `${t('app.kuaizhizao.logistics.detail.freightOrderTitle')}${code ? ` - ${code}` : ''}`;

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
      linesTitle={t('app.kuaizhizao.logistics.section.sources')}
      lines={
        contentReady ? (
          sources.length > 0 ? (
            <Table<FreightOrderSource>
              size="small"
              pagination={false}
              rowKey={(row, idx) => String(row.id ?? `${row.source_type}-${row.source_id}-${idx}`)}
              dataSource={sources}
              columns={[
                {
                  title: t('app.kuaizhizao.logistics.field.sourceCode'),
                  dataIndex: 'source_code',
                  render: (_, row) => (
                    <SourceDocumentCode
                      sourceType={row.source_type}
                      sourceId={row.source_id}
                      sourceCode={row.source_code}
                    />
                  ),
                },
                {
                  title: t('app.kuaizhizao.logistics.field.partnerName'),
                  dataIndex: 'partner_name',
                  render: (v) => (v != null && String(v).trim() ? String(v) : '-'),
                },
              ]}
            />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('app.kuaizhizao.logistics.detail.noSources')}
            />
          )
        ) : undefined
      }
      timeline={
        contentReady ? (
          events.length > 0 ? (
            <Timeline
              items={events.map((event) => ({
                children: (
                  <Typography.Text>
                    {logisticsTrackingEventLabel(t, event.event_type)}
                    {event.location ? ` ${event.location}` : ''}
                    {event.remark ? ` ${event.remark}` : ''}
                    {event.event_time ? ` ${formatDateTimeBySiteSetting(event.event_time)}` : ''}
                    {event.operator_name ? ` ${event.operator_name}` : ''}
                  </Typography.Text>
                ),
              }))}
            />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('app.kuaizhizao.logistics.detail.noTracking')}
            />
          )
        ) : undefined
      }
    />
  );
};
