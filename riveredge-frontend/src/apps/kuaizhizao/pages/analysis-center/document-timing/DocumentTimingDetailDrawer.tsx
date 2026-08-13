/**
 * 单据节点耗时详情抽屉。
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
} from '../../../../../components/layout-templates';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { formatDateTimeBySiteSetting } from '../../../../../utils/format';
import { alignDescriptionColumns } from '../../sales-management/shared/documentFieldAlignment';
import { getDocumentTimingLifecycle } from '../../../utils/documentTimingLifecycle';
import { renderReportDocTypeMarker } from '../../../../kuaireport/utils/reportListPresentation';

export type DocumentTimingNode = {
  id?: number;
  node_name?: string;
  node_code?: string;
  start_time?: string;
  end_time?: string;
  duration_seconds?: number;
  duration_hours?: number;
  operator_name?: string;
};

export type DocumentTiming = {
  document_type?: string;
  document_id?: number;
  document_code?: string;
  total_duration_seconds?: number;
  total_duration_hours?: number;
  nodes?: DocumentTimingNode[];
};

export type DocumentTimingDetailDrawerProps = {
  open: boolean;
  onClose: () => void;
  record: DocumentTiming | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
};

function docTypeLabel(t: (key: string, opts?: { defaultValue?: string }) => string, type?: string) {
  if (type === 'work_order') return t('app.kuaireport.analysis.docType.workOrder', { defaultValue: '工单' });
  if (type === 'purchase_order') return t('app.kuaireport.analysis.docType.purchaseOrder', { defaultValue: '采购订单' });
  if (type === 'sales_order') return t('app.kuaireport.analysis.docType.salesOrder', { defaultValue: '销售订单' });
  return type || '-';
}

export const DocumentTimingDetailDrawer: React.FC<DocumentTimingDetailDrawerProps> = ({
  open,
  onClose,
  record,
  loading = false,
  error = null,
  onRetry,
}) => {
  const { t } = useTranslation();

  const contentReady = Boolean(record);
  const showError = Boolean(error) && !contentReady && !loading;
  const showLoading = loading || (!contentReady && !showError);

  const columns = useMemo<ProDescriptionsItemProps<DocumentTiming>[]>(
    () =>
      alignDescriptionColumns([
        {
          title: t('app.kuaireport.analysis.col.documentType', { defaultValue: '单据类型' }),
          dataIndex: 'document_type',
          render: (_, row) =>
            renderReportDocTypeMarker(
              docTypeLabel(t, row.document_type),
              row.document_type === 'work_order'
                ? 'processing'
                : row.document_type === 'purchase_order'
                  ? 'default'
                  : 'success',
            ),
        },
        {
          title: t('app.kuaireport.analysis.col.documentCode', { defaultValue: '单据编号' }),
          dataIndex: 'document_code',
          copyable: true,
        },
        {
          title: t('app.kuaireport.analysis.col.totalHours', { defaultValue: '总耗时（小时）' }),
          dataIndex: 'total_duration_hours',
          render: (_, row) => row.total_duration_hours?.toFixed(2) ?? '-',
        },
        {
          title: t('app.kuaireport.analysis.col.totalSeconds', { defaultValue: '总耗时（秒）' }),
          dataIndex: 'total_duration_seconds',
          render: (_, row) => row.total_duration_seconds ?? '-',
        },
      ]),
    [t],
  );

  const nodeColumns = useMemo(
    () => [
      { title: t('app.kuaireport.analysis.col.nodeName', { defaultValue: '节点名称' }), dataIndex: 'node_name', key: 'node_name', width: 120 },
      {
        title: t('app.kuaireport.analysis.col.startTime', { defaultValue: '开始时间' }),
        dataIndex: 'start_time',
        key: 'start_time',
        width: 160,
        render: (value: string) => (value ? formatDateTimeBySiteSetting(value) : '-'),
      },
      {
        title: t('app.kuaireport.analysis.col.endTime', { defaultValue: '结束时间' }),
        dataIndex: 'end_time',
        key: 'end_time',
        width: 160,
        render: (value: string) => (value ? formatDateTimeBySiteSetting(value) : '-'),
      },
      {
        title: t('app.kuaireport.analysis.col.durationHours', { defaultValue: '耗时（小时）' }),
        dataIndex: 'duration_hours',
        key: 'duration_hours',
        width: 120,
        align: 'right' as const,
        render: (value: number) => value?.toFixed(2) || '-',
      },
      { title: t('app.kuaireport.analysis.col.operator', { defaultValue: '操作人' }), dataIndex: 'operator_name', key: 'operator_name', width: 100 },
    ],
    [t],
  );

  if (!open) return null;

  const nodes = record?.nodes ?? [];

  return (
    <DetailDrawerTemplate
      title={
        <span>
          {t('app.kuaireport.analysis.timing.detailTitle', { defaultValue: '耗时统计' })}
          {record?.document_code ? (
            <Typography.Text type="secondary" style={{ marginLeft: 8 }} copyable={{ text: String(record.document_code) }}>
              {record.document_code}
            </Typography.Text>
          ) : null}
        </span>
      }
      open={open}
      onClose={onClose}
      width={DRAWER_CONFIG.HALF_WIDTH}
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
      basic={
        contentReady && record ? (
          <Descriptions
            column={detailDrawerBasicColumn(false)}
            size="small"
            items={detailDrawerDescriptionItems(columns, record)}
          />
        ) : showError ? null : (
          <div style={{ minHeight: 80 }} />
        )
      }
      collaboration={contentReady && record ? <UniLifecycle {...getDocumentTimingLifecycle(record)} showCircleTooltip={false} /> : null}
      collaborationTitle={t('app.kuaireport.analysis.col.lifecycle', { defaultValue: '生命周期' })}
      lines={
        contentReady ? (
          nodes.length ? (
            <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
              <Table
                columns={nodeColumns}
                dataSource={nodes}
                rowKey={(r, index) => String(r.id ?? r.node_code ?? index)}
                pagination={false}
                size="small"
              />
            </div>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('app.kuaireport.analysis.timing.noNodes', { defaultValue: '暂无节点明细' })}
            />
          )
        ) : null
      }
      linesTitle={t('app.kuaireport.analysis.timing.nodeDetail', { defaultValue: '节点明细' })}
      timeline={
        contentReady ? (
          nodes.length ? (
            <Timeline
              items={nodes.slice(0, 12).map((n, i) => ({
                key: String(n.id ?? i),
                color: 'blue',
                children: (
                  <>
                    {n.node_name || n.node_code || t('app.kuaireport.analysis.col.node', { defaultValue: '节点' })}
                    {' '}
                    {n.end_time || n.start_time
                      ? `${n.start_time ? formatDateTimeBySiteSetting(n.start_time) : ''} → ${n.end_time ? formatDateTimeBySiteSetting(n.end_time) : ''}`
                      : '-'}
                    {n.operator_name ? ` - ${n.operator_name}` : ''}
                  </>
                ),
              }))}
            />
          ) : (
            <Typography.Text type="secondary">
              {t('app.kuaireport.analysis.timing.noTimeline', { defaultValue: '暂无节点级时间线' })}
            </Typography.Text>
          )
        ) : null
      }
      timelineTitle={t('app.kuaireport.analysis.timing.timeline', { defaultValue: '节点时间线' })}
    />
  );
};
