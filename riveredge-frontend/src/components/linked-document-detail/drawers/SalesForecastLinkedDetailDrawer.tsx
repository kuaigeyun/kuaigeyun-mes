/**
 * 关联单据：销售预测原版详情（只读插槽壳）
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Descriptions, Spin, Table, Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { DetailDrawerTemplate, DRAWER_CONFIG } from '../../layout-templates';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../document-tracking-panel';
import { UniLifecycleStepper } from '../../uni-lifecycle';
import { getSalesForecast, type SalesForecast } from '../../../apps/kuaizhizao/services/sales-forecast';
import { getSalesForecastLifecycle } from '../../../apps/kuaizhizao/utils/salesForecastLifecycle';
import { useAuditRequired } from '../../../hooks/useAuditRequired';
import { formatDateTime } from '../../../utils/format';

export type SalesForecastLinkedDetailDrawerProps = {
  open: boolean;
  documentId: number;
  onClose: () => void;
  zIndex?: number;
};

export function SalesForecastLinkedDetailDrawer({
  open,
  documentId,
  onClose,
  zIndex,
}: SalesForecastLinkedDetailDrawerProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const auditRequired = useAuditRequired('sales_forecast', false);
  const [detail, setDetail] = useState<SalesForecast | null>(null);
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
      setDetail(await getSalesForecast(documentId));
    } catch (e: unknown) {
      const err = e as { message?: string; detail?: string };
      message.error(err?.message || err?.detail || t('common.loadFailed'));
      onClose();
    } finally {
      setLoading(false);
    }
  }, [open, documentId, message, onClose, t]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const lifecycle = useMemo(
    () => (detail ? getSalesForecastLifecycle(detail, auditRequired, t) : null),
    [detail, auditRequired, t],
  );
  const nextSteps = lifecycle?.nextStepSuggestions;
  const showNextInTitle = Boolean(nextSteps?.length);
  const tracking = useDocumentTracking(
    open && detail?.id ? 'sales_forecast' : undefined,
    detail?.id,
    refreshKey,
  );

  const title = detail?.forecast_code
    ? `${t('app.kuaizhizao.salesForecast.detailTitle')} - ${detail.forecast_code}`
    : t('app.kuaizhizao.salesForecast.detailTitle');

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

  return (
    <DetailDrawerTemplate
      title={title}
      open={open}
      onClose={onClose}
      width={DRAWER_CONFIG.HALF_WIDTH}
      zIndex={zIndex}
      collaborationTitleSuffix={
        showNextInTitle ? (
          <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
            {t('components.uniLifecycle.nextStep')}：
            {nextSteps!.join(t('components.uniLifecycle.nextStepSeparator'))}
          </Typography.Text>
        ) : undefined
      }
      collaborationAuditRecord={detail as any}
      collaborationLifecycle={
        lifecycle ? (
          <UniLifecycleStepper
            steps={lifecycle.mainStages ?? []}
            status={lifecycle.status}
            showLabels
            nextStepSuggestions={lifecycle.nextStepSuggestions}
            hideNextStepSuggestions={Boolean(nextSteps?.length)}
          />
        ) : undefined
      }
      basic={
        <Descriptions
          column={3}
          size="small"
          items={[
            { key: 'forecast_code', label: t('app.kuaizhizao.salesForecast.forecastCode'), children: detail.forecast_code || '-' },
            { key: 'forecast_name', label: t('app.kuaizhizao.salesForecast.forecastName'), children: detail.forecast_name || '-' },
            {
              key: 'forecast_period',
              label: t('app.kuaizhizao.salesForecast.forecastPeriod'),
              children: detail.forecast_period || '-',
            },
            {
              key: 'start_date',
              label: t('app.kuaizhizao.salesForecast.startDate'),
              children: detail.start_date ? formatDateTime(detail.start_date, 'YYYY-MM-DD') : '-',
            },
            {
              key: 'end_date',
              label: t('app.kuaizhizao.salesForecast.endDate'),
              children: detail.end_date ? formatDateTime(detail.end_date, 'YYYY-MM-DD') : '-',
            },
            {
              key: 'status',
              label: t('app.kuaizhizao.salesForecast.status'),
              children: <Tag>{lifecycle?.stageName || detail.status || '-'}</Tag>,
            },
            {
              key: 'notes',
              label: t('app.kuaizhizao.salesForecast.notes'),
              children: detail.notes || '-',
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
          scroll={{ x: 760 }}
          dataSource={detail.items ?? []}
          columns={[
            { title: t('app.kuaizhizao.salesForecast.materialCode'), dataIndex: 'material_code', width: 140 },
            { title: t('app.kuaizhizao.salesForecast.materialName'), dataIndex: 'material_name', width: 180, ellipsis: true },
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
              render: (v) => (v ? formatDateTime(v, 'YYYY-MM-DD') : '-'),
            },
          ]}
          locale={{ emptyText: t('app.kuaizhizao.salesForecast.emptyItems') }}
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
        documentType: 'sales_forecast',
        documentId: detail.id!,
        selfDocumentId: detail.id!,
      }}
    />
  );
}
