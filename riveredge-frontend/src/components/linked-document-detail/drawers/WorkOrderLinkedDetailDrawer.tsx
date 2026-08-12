/**
 * 关联单据：生产工单原版详情（只读插槽壳）
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Descriptions, Spin, Table, Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { DetailDrawerTemplate, DRAWER_CONFIG } from '../../layout-templates';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../document-tracking-panel';
import { UniLifecycleStepper } from '../../uni-lifecycle';
import { workOrderApi } from '../../../apps/kuaizhizao/services/work-order';
import { getWorkOrderLifecycle } from '../../../apps/kuaizhizao/utils/workOrderLifecycle';
import { formatDateTime, formatQuantity } from '../../../utils/format';

export type WorkOrderLinkedDetailDrawerProps = {
  open: boolean;
  documentId: number;
  onClose: () => void;
  zIndex?: number;
};

export function WorkOrderLinkedDetailDrawer({
  open,
  documentId,
  onClose,
  zIndex,
}: WorkOrderLinkedDetailDrawerProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [detail, setDetail] = useState<Record<string, any> | null>(null);
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
      setDetail(await workOrderApi.get(String(documentId)));
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

  const lifecycle = useMemo(() => (detail ? getWorkOrderLifecycle(detail) : null), [detail]);
  const nextSteps = lifecycle?.nextStepSuggestions;
  const tracking = useDocumentTracking(
    open && detail?.id ? 'work_order' : undefined,
    detail?.id,
    refreshKey,
  );

  const code = String(detail?.work_order_code ?? detail?.code ?? '').trim();
  const title = code
    ? `${t('app.kuaizhizao.menu.production-execution.work-orders')} - ${code}`
    : t('app.kuaizhizao.menu.production-execution.work-orders');

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

  const operations = Array.isArray(detail.operations) ? detail.operations : [];

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
            {
              key: 'work_order_code',
              label: t('app.kuaizhizao.workReporting.colWorkOrderCode'),
              children: code || '-',
            },
            {
              key: 'product_code',
              label: t('app.kuaizhizao.workReporting.colWorkOrderName'),
              children: detail.product_name || detail.work_order_name || '-',
            },
            {
              key: 'status',
              label: t('common.status'),
              children: <Tag>{lifecycle?.stageName || detail.status || '-'}</Tag>,
            },
            {
              key: 'quantity',
              label: t('app.kuaizhizao.reworkOrder.colQuantity'),
              children: formatQuantity(detail.quantity ?? detail.planned_quantity),
            },
            {
              key: 'planned_start',
              label: t('common.start'),
              children: detail.planned_start_time
                ? formatDateTime(detail.planned_start_time)
                : detail.planned_start_date
                  ? formatDateTime(detail.planned_start_date, 'YYYY-MM-DD')
                  : '-',
            },
            {
              key: 'planned_end',
              label: t('common.end'),
              children: detail.planned_end_time
                ? formatDateTime(detail.planned_end_time)
                : detail.planned_end_date
                  ? formatDateTime(detail.planned_end_date, 'YYYY-MM-DD')
                  : '-',
            },
          ]}
        />
      }
      lines={
        <Table
          size="small"
          rowKey={(r) => String(r.id ?? r.operation_id ?? Math.random())}
          pagination={false}
          scroll={{ x: 720 }}
          dataSource={operations}
          columns={[
            {
              title: t('app.kuaizhizao.workReporting.colOperation'),
              dataIndex: 'operation_name',
              width: 160,
            },
            {
              title: t('app.kuaizhizao.workReporting.colWorker'),
              dataIndex: 'assigned_worker_name',
              width: 120,
              render: (v, row) => v || row.worker_name || '-',
            },
            {
              title: t('common.status'),
              dataIndex: 'status',
              width: 100,
            },
          ]}
          locale={{ emptyText: t('app.kuaizhizao.salesOrder.emptyItems') }}
        />
      }
      timeline={
        <>
          {tracking.loading ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <Spin />
            </div>
          ) : null}
          {tracking.data && !tracking.loading ? <DocumentTrackingTimelineBody data={tracking.data} /> : null}
        </>
      }
      traceDocument={{
        documentType: 'work_order',
        documentId: Number(detail.id),
        selfDocumentId: Number(detail.id),
      }}
    />
  );
}
