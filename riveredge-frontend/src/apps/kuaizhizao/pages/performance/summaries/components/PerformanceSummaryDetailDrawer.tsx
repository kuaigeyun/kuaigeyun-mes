/**
 * 绩效汇总详情抽屉。
 * 单一 DetailDrawerTemplate：加载中遮罩，失败 Result+重试。
 */

import React, { useMemo } from 'react';
import { Button, Descriptions, Empty, Result, Table } from 'antd';
import { useTranslation } from 'react-i18next';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import {
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  detailDrawerBasicColumn,
  useDetailDrawerDescriptionItems,
} from '../../../../../../components/layout-templates';
import { UniLifecycleStepper } from '../../../../../../components/uni-lifecycle';
import { DocumentTrackingTimelineBody } from '../../../../../../components/document-tracking-panel';
import type { UseDocumentTrackingResult } from '../../../../../../components/document-tracking-panel/useDocumentTracking';
import { formatDateTimeBySiteSetting } from '../../../../../../utils/format';
import { LinkedDocumentCode } from '../../../../../../components/linked-document-code';
import { alignDescriptionColumns } from '../../../sales-management/shared/documentFieldAlignment';
import { getPerformanceSummaryLifecycle } from '../../../../utils/performanceLifecycle';
import { renderSummaryStatusTag } from '../../components/performanceMeta';
import { PerformanceTraceBriefPrimaryActions } from '../../PerformanceTraceBriefFooter';
import type { NavigateFunction } from 'react-router-dom';
import type { TFunction } from 'i18next';
import type { PerformanceDetail, PerformanceDetailItem } from '../../../../types/performance';

const PLACEHOLDER: PerformanceDetail = {
  employee_id: 0,
  period: '',
  items: [],
};

function reportingItemDisplayCode(row: PerformanceDetailItem): string {
  const op = String(row.operation_name ?? '').trim();
  if (op) return `${op}-${row.reporting_record_id}`;
  return `BG${row.reporting_record_id}`;
}

export type PerformanceSummaryDetailDrawerProps = {
  open: boolean;
  onClose: () => void;
  record: PerformanceDetail | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  extra?: React.ReactNode;
  zIndex?: number;
  trackingId?: number | null;
  tracking?: UseDocumentTrackingResult;
  navigate: NavigateFunction;
};

export const PerformanceSummaryDetailDrawer: React.FC<PerformanceSummaryDetailDrawerProps> = ({
  open,
  onClose,
  record,
  loading = false,
  error = null,
  onRetry,
  extra,
  zIndex,
  trackingId,
  tracking,
  navigate,
}) => {
  const { t } = useTranslation();

  const contentReady = Boolean(record);
  const showError = Boolean(error) && !contentReady && !loading;
  const showLoading = loading || (!contentReady && !showError);
  const effective = record ?? PLACEHOLDER;

  const columns = useMemo(
    () =>
      alignDescriptionColumns([
        { title: t('app.kuaizhizao.performance.common.columns.employee'), dataIndex: 'employee_name' },
        { title: t('app.kuaizhizao.performance.common.columns.period'), dataIndex: 'period' },
        {
          title: t('app.kuaizhizao.performance.common.columns.totalHours'),
          dataIndex: 'total_hours',
          render: (_, row) => (row as PerformanceDetail).summary?.total_hours ?? '-',
        },
        {
          title: t('app.kuaizhizao.performance.common.columns.totalPieces'),
          dataIndex: 'total_pieces',
          render: (_, row) => (row as PerformanceDetail).summary?.total_pieces ?? '-',
        },
        {
          title: t('app.kuaizhizao.performance.common.columns.timeAmount'),
          dataIndex: 'time_amount',
          render: (_, row) => (row as PerformanceDetail).summary?.time_amount ?? '-',
        },
        {
          title: t('app.kuaizhizao.performance.common.columns.pieceAmount'),
          dataIndex: 'piece_amount',
          render: (_, row) => (row as PerformanceDetail).summary?.piece_amount ?? '-',
        },
        {
          title: t('app.kuaizhizao.performance.common.columns.totalAmount'),
          dataIndex: 'total_amount',
          render: (_, row) => (row as PerformanceDetail).summary?.total_amount ?? '-',
        },
        {
          title: t('app.kuaizhizao.performance.common.columns.kpiScore'),
          dataIndex: 'kpi_score',
          render: (_, row) => (row as PerformanceDetail).summary?.kpi_score ?? '-',
        },
        {
          title: t('app.kuaizhizao.performance.common.columns.kpiCoefficient'),
          dataIndex: 'kpi_coefficient',
          render: (_, row) => (row as PerformanceDetail).summary?.kpi_coefficient ?? '-',
        },
        {
          title: t('common.status'),
          dataIndex: 'status',
          render: (_, row) => renderSummaryStatusTag(t, (row as PerformanceDetail).summary?.status),
        },
      ] as ProDescriptionsItemProps<Record<string, unknown>>[]),
    [t],
  );

  const items = effective.items ?? [];
  const kpiScores = effective.kpi_scores ?? [];
  const lifecycleRow = (effective.summary ?? effective) as unknown as Record<string, unknown>;
  const lifecycle = getPerformanceSummaryLifecycle(lifecycleRow, t);
  const code = String(effective.employee_name ?? '').trim();
  const period = String(effective.period ?? '').trim();
  const title = t('app.kuaizhizao.performance.summaries.modal.detailTitle', {
    name: code,
    period,
  });

  const timeconfigBasicItems = useDetailDrawerDescriptionItems(
    columns, effective
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
      extra={contentReady ? extra ?? null : null}
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
      collaborationTitle={t('app.kuaizhizao.performance.common.sections.lifecycle')}
      collaborationLifecycle={
        contentReady && (lifecycle.mainStages?.length ?? 0) > 0 ? (
          <UniLifecycleStepper
            steps={lifecycle.mainStages}
            showLabels
            status={lifecycle.status}
            nextStepSuggestions={lifecycle.nextStepSuggestions}
            hideNextStepSuggestions
          />
        ) : undefined
      }
      traceDocument={
        contentReady && trackingId != null
          ? {
              documentType: 'performance_summary',
              documentId: trackingId,
              selfDocumentId: trackingId,
              renderBriefActions: (doc) => (
                <PerformanceTraceBriefPrimaryActions
                  doc={doc}
                  t={t as TFunction}
                  navigate={navigate}
                  closeDrawer={onClose}
                />
              ),
            }
          : undefined
      }
      supplementaryTitle={t('app.kuaizhizao.performance.summaries.sections.kpiScores')}
      supplementaryVisible={contentReady && kpiScores.length > 0}
      supplementary={
        contentReady && kpiScores.length > 0 ? (
          <Table
            size="small"
            rowKey="kpi_code"
            pagination={false}
            dataSource={kpiScores}
            columns={[
              { title: t('app.kuaizhizao.performance.summaries.columns.kpiCode'), dataIndex: 'kpi_code' },
              { title: t('app.kuaizhizao.performance.summaries.columns.score'), dataIndex: 'score', align: 'right' },
            ]}
          />
        ) : undefined
      }
      linesTitle={t('app.kuaizhizao.performance.summaries.sections.reportingItems')}
      lines={
        contentReady ? (
          items.length > 0 ? (
            <Table<PerformanceDetailItem>
              size="small"
              pagination={false}
              rowKey={(row) => String(row.reporting_record_id)}
              dataSource={items}
              columns={[
                {
                  title: t('app.kuaizhizao.performance.summaries.columns.reportingRecord'),
                  dataIndex: 'reporting_record_id',
                  render: (_, row) => (
                    <LinkedDocumentCode
                      documentType="reporting_record"
                      documentId={row.reporting_record_id}
                      code={reportingItemDisplayCode(row)}
                    />
                  ),
                },
                {
                  title: t('app.kuaizhizao.performance.summaries.columns.workOrder'),
                  dataIndex: 'work_order_code',
                  render: (_, row) => (
                    <LinkedDocumentCode
                      documentType="work_order"
                      documentId={row.work_order_id}
                      code={row.work_order_code}
                    />
                  ),
                },
                { title: t('app.kuaizhizao.performance.summaries.columns.operation'), dataIndex: 'operation_name' },
                {
                  title: t('app.kuaizhizao.performance.summaries.columns.reportedAt'),
                  dataIndex: 'reported_at',
                  render: (value) => (value ? formatDateTimeBySiteSetting(String(value)) : '-'),
                },
                {
                  title: t('app.kuaizhizao.performance.common.columns.qualifiedQty'),
                  dataIndex: 'qualified_quantity',
                  align: 'right',
                },
                {
                  title: t('app.kuaizhizao.performance.summaries.columns.workHours'),
                  dataIndex: 'work_hours',
                  align: 'right',
                },
              ]}
            />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('app.kuaizhizao.performance.common.empty.noReportingItems')}
            />
          )
        ) : undefined
      }
      timelineTitle={t('app.kuaizhizao.performance.common.sections.operationLog')}
      timeline={
        contentReady && tracking && !tracking.loading ? (
          tracking.data ? (
            <DocumentTrackingTimelineBody data={tracking.data} />
          ) : tracking.error ? (
            <Result status="error" title={tracking.error} />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('app.kuaizhizao.performance.common.empty.noActivityLog')}
            />
          )
        ) : undefined
      }
    />
  );
};
