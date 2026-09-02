/**
 * 销售预测原版详情抽屉（列表 / 关联嵌套共用）。
 * 单一 DetailDrawerTemplate：加载中遮罩，失败 Result+重试，禁止两棵壳切换。
 */

import React, { useMemo } from 'react';
import { Button, Descriptions, Result, Space, Table, Typography } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import {
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  useDetailDrawerDescriptionItems,
  type TraceBriefDocument,
} from '../../../../../../components/layout-templates';
import { UniLifecycleStepper } from '../../../../../../components/uni-lifecycle';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../../components/document-tracking-panel';
import { UniWorkflowActions } from '../../../../../../components/uni-workflow-actions';
import { rowActionKind } from '../../../../../../components/uni-action';
import { useResourcePermissions } from '../../../../../../hooks/useResourcePermissions';
import { useKuaizhizaoPrintModal } from '../../../../hooks/useKuaizhizaoPrintModal';
import { getSalesForecastLifecycle } from '../../../../utils/salesForecastLifecycle';
import type { SalesForecast } from '../../../../services/sales-forecast';
import { alignDescriptionColumns } from '../../shared/documentFieldAlignment';
import { formatDateBySiteSetting } from '../../../../../../utils/format';

const SALES_FORECAST_RESOURCE = 'kuaizhizao:sales-forecast';

const PLACEHOLDER_FORECAST: SalesForecast = { id: 0 };

const FORECAST_WORKFLOW_PROPS = {
  entityType: 'sales_forecast' as const,
  auditNodeKey: 'sales_forecast',
  resourcePrefix: SALES_FORECAST_RESOURCE,
  unifiedAudit: true,
  statusField: 'status' as const,
  reviewStatusField: 'review_status' as const,
  draftStatuses: ['草稿', 'DRAFT'],
  pendingStatuses: ['待审核', 'PENDING_REVIEW'],
  approvedStatuses: ['已审核', 'AUDITED', 'APPROVED', '审核通过', '通过', '已通过'],
  rejectedStatuses: ['已驳回', 'REJECTED', '审核驳回'],
};

function formatForecastPeriod(period: string | undefined, t: (key: string) => string): string {
  if (!period) return '-';
  const periodMap: Record<string, string> = {
    WEEKLY: t('app.kuaizhizao.salesForecast.period.weekly'),
    MONTHLY: t('app.kuaizhizao.salesForecast.period.monthly'),
    QUARTERLY: t('app.kuaizhizao.salesForecast.period.quarterly'),
  };
  return periodMap[period] || period;
}

export type SalesForecastDetailDrawerProps = {
  open: boolean;
  onClose: () => void;
  forecast: SalesForecast | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  zIndex?: number;
  auditRequired: boolean;
  trackingRefreshKey?: number;
  extra?: React.ReactNode;
  showReadonlyActions?: boolean;
  onWorkflowSuccess?: () => void;
  renderBriefActions?: (doc: TraceBriefDocument) => React.ReactNode;
};

export const SalesForecastDetailReadonlyExtra: React.FC<{
  forecast: SalesForecast;
  onWorkflowSuccess?: () => void;
}> = ({ forecast, onWorkflowSuccess }) => {
  const { t } = useTranslation();
  const perms = useResourcePermissions(SALES_FORECAST_RESOURCE);
  const { openPrint, PrintModal } = useKuaizhizaoPrintModal();
  return (
    <>
      <Space size="small">
        <UniWorkflowActions
          {...rowActionKind('skip')}
          record={forecast}
          entityName={t('app.kuaizhizao.salesForecast.title')}
          {...FORECAST_WORKFLOW_PROPS}
          theme="default"
          onSuccess={() => onWorkflowSuccess?.()}
        />
        {forecast.id != null && perms.canPrint ? (
          <Button
            icon={<PrinterOutlined />}
            onClick={() => openPrint({ documentType: 'sales_forecast', documentId: forecast.id! })}
          >
            {t('components.uniAction.print')}
          </Button>
        ) : null}
      </Space>
      {PrintModal}
    </>
  );
};

export const SalesForecastDetailDrawer: React.FC<SalesForecastDetailDrawerProps> = ({
  open,
  onClose,
  forecast,
  loading = false,
  error = null,
  onRetry,
  zIndex,
  auditRequired,
  trackingRefreshKey = 0,
  extra,
  showReadonlyActions = true,
  onWorkflowSuccess,
  renderBriefActions,
}) => {
  const { t } = useTranslation();
  const contentReady = Boolean(forecast);
  const showError = Boolean(error) && !contentReady && !loading;
  const showLoading = loading || (!contentReady && !showError);
  const effective = forecast ?? PLACEHOLDER_FORECAST;

  const tracking = useDocumentTracking(
    open && contentReady ? 'sales_forecast' : undefined,
    effective.id,
    trackingRefreshKey,
  );

  const lifecycle = useMemo(
    () => (contentReady ? getSalesForecastLifecycle(effective, auditRequired, t) : null),
    [contentReady, effective, auditRequired, t],
  );
  const nextSteps = lifecycle?.nextStepSuggestions;
  const showNextInTitle = Boolean(nextSteps?.length);

  const basicColumns = useMemo(
    () =>
      alignDescriptionColumns<SalesForecast>([
        { title: t('app.kuaizhizao.salesForecast.forecastCode'), dataIndex: 'forecast_code' },
        { title: t('app.kuaizhizao.salesForecast.forecastName'), dataIndex: 'forecast_name' },
        {
          title: t('app.kuaizhizao.salesForecast.forecastPeriod'),
          dataIndex: 'forecast_period',
          render: (_, record) => formatForecastPeriod(record.forecast_period, t),
        },
        { title: t('app.kuaizhizao.salesForecast.startDate'), dataIndex: 'start_date', valueType: 'date' },
        { title: t('app.kuaizhizao.salesForecast.endDate'), dataIndex: 'end_date', valueType: 'date' },
        { title: t('common.remark'), dataIndex: 'notes', span: 3 },
      ] as ProDescriptionsItemProps<SalesForecast>[]),
    [t],
  );

  const title = `${t('app.kuaizhizao.salesForecast.detailTitle')}${
    forecast?.forecast_code ? ` - ${forecast.forecast_code}` : ''
  }`;

  const timeconfigBasicItems = useDetailDrawerDescriptionItems(
    basicColumns, effective,
    'sales_forecast',
  );

  if (!open) return null;

  return (
    <DetailDrawerTemplate
      title={title}
      open={open}
      onClose={onClose}
      size={DRAWER_CONFIG.HALF_WIDTH}
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
      extra={
        contentReady
          ? extra ??
            (showReadonlyActions ? (
              <SalesForecastDetailReadonlyExtra forecast={effective} onWorkflowSuccess={onWorkflowSuccess} />
            ) : null)
          : null
      }
      collaborationTitleSuffix={
        contentReady && showNextInTitle ? (
          <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
            {t('common.next')}：
            {nextSteps!.join(t('components.uniLifecycle.nextStepSeparator'))}
          </Typography.Text>
        ) : undefined
      }
      collaborationAuditRecord={contentReady ? effective : null}
      basic={
        contentReady ? (
          <Descriptions column={3} size="small" items={timeconfigBasicItems} />
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
            hideNextStepSuggestions={showNextInTitle}
          />
        ) : null
      }
      lines={
        contentReady ? (
          (effective.items || []).length > 0 ? (
            <Table
              size="small"
              rowKey="id"
              tableLayout="fixed"
              style={{ minWidth: 760 }}
              dataSource={effective.items || []}
              pagination={false}
              columns={[
                { title: t('app.kuaizhizao.salesForecast.materialCode'), dataIndex: 'material_code', width: 140 },
                {
                  title: t('app.kuaizhizao.salesForecast.materialName'),
                  dataIndex: 'material_name',
                  width: 180,
                  ellipsis: true,
                },
                {
                  title: t('app.kuaizhizao.salesForecast.forecastQuantity'),
                  dataIndex: 'forecast_quantity',
                  width: 120,
                  align: 'right',
                },
                {
                  title: t('app.kuaizhizao.salesForecast.forecastDate'),
                  dataIndex: 'forecast_date',
                  width: 120,
                  render: (v: string) => (v ? formatDateBySiteSetting(v) : '-'),
                },
              ]}
            />
          ) : (
            <Typography.Text type="secondary">{t('app.kuaizhizao.salesForecast.emptyItems')}</Typography.Text>
          )
        ) : null
      }
      timeline={
        contentReady ? (
          tracking.data ? (
            <DocumentTrackingTimelineBody data={tracking.data} />
          ) : (
            <Typography.Text type="secondary">{t('app.kuaizhizao.salesForecast.emptyTimeline')}</Typography.Text>
          )
        ) : null
      }
      traceDocument={
        contentReady && effective.id != null
          ? {
              documentType: 'sales_forecast',
              documentId: effective.id,
              selfDocumentId: effective.id,
              renderBriefActions,
            }
          : undefined
      }
    />
  );
};
